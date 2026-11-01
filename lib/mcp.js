'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

/**
 * Turns a Swagger 2.0 or OpenAPI 3.x document into the tool definitions the gateway serves over
 * MCP, in the same format the soajs services return on GET /mcp/tools:
 * {m, v, l, group, operationId, inputSchema, fields}
 *
 * fields says where each tool argument goes when the API call is rebuilt:
 * {in: "params" | "query" | "body", path: [...]}; an empty path means the argument is the whole
 * body (a body that is not an object with properties).
 */

const METHODS = ['get', 'post', 'put', 'delete'];

const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

// Swagger 2 keeps the schema keywords on the parameter itself
const SWAGGER2_SCHEMA_KEYS = ['type', 'format', 'items', 'enum', 'default', 'minimum', 'maximum',
	'exclusiveMinimum', 'exclusiveMaximum', 'minLength', 'maxLength', 'pattern', 'minItems',
	'maxItems', 'uniqueItems', 'multipleOf', 'description'];

// OpenAPI keywords that are not JSON Schema
const DROP_KEYS = ['xml', 'externalDocs', 'discriminator', 'example', 'deprecated', 'nullable',
	'readOnly', 'writeOnly', 'collectionFormat', 'allowEmptyValue'];

let isObject = (obj) => {
	return !!obj && typeof obj === 'object' && !Array.isArray(obj);
};

/**
 * Follows a local reference: "#/definitions/User", "#/components/schemas/User".
 */
let lookup = (doc, ref) => {
	if (typeof ref !== 'string' || ref.indexOf('#/') !== 0) {
		return null;
	}
	let node = doc;
	let parts = ref.substring(2).split('/');
	for (let i = 0; i < parts.length; i++) {
		let part = parts[i].replace(/~1/g, '/').replace(/~0/g, '~');
		if (DANGEROUS_KEYS.indexOf(part) !== -1 || !isObject(node) || !Object.hasOwnProperty.call(node, part)) {
			return null;
		}
		node = node[part];
	}
	return node;
};

/**
 * Follows $ref until a real object is reached.
 */
let deref = (doc, obj, seen) => {
	seen = seen || [];
	while (isObject(obj) && typeof obj.$ref === 'string') {
		if (seen.indexOf(obj.$ref) !== -1) {
			return null;
		}
		seen.push(obj.$ref);
		obj = lookup(doc, obj.$ref);
	}
	return obj;
};

/**
 * Resolves the $refs of a schema into one self-contained JSON Schema. A reference that loops back
 * on itself becomes {} (any value), so a recursive model does not recurse forever.
 * readOnly properties are left out: they are not sent in a request.
 */
let resolve = (doc, schema, stack) => {
	stack = stack || [];
	if (Array.isArray(schema)) {
		return schema.map((item) => resolve(doc, item, stack));
	}
	if (!isObject(schema)) {
		return schema;
	}
	if (typeof schema.$ref === 'string') {
		if (stack.indexOf(schema.$ref) !== -1) {
			return {};
		}
		let target = lookup(doc, schema.$ref);
		if (!isObject(target)) {
			return {};
		}
		return resolve(doc, target, stack.concat([schema.$ref]));
	}
	let out = {};
	Object.keys(schema).forEach((key) => {
		if (DANGEROUS_KEYS.indexOf(key) !== -1 || DROP_KEYS.indexOf(key) !== -1) {
			return;
		}
		let value = schema[key];
		if (key === 'properties' && isObject(value)) {
			out.properties = {};
			Object.keys(value).forEach((prop) => {
				if (DANGEROUS_KEYS.indexOf(prop) !== -1 || !isObject(value[prop])) {
					return;
				}
				let propSchema = deref(doc, value[prop]);
				if (isObject(propSchema) && propSchema.readOnly === true) {
					return;
				}
				out.properties[prop] = resolve(doc, value[prop], stack);
			});
		} else if (key === 'required' && Array.isArray(value)) {
			out.required = value.slice();
		} else if (isObject(value) || Array.isArray(value)) {
			out[key] = resolve(doc, value, stack);
		} else {
			out[key] = value;
		}
	});
	// OpenAPI 3.0: nullable: true -> also accept null
	if (schema.nullable === true && typeof schema.type === 'string') {
		out.type = [schema.type, 'null'];
	}
	// Swagger 2 file upload
	if (out.type === 'file') {
		out.type = 'string';
	}
	if (out.properties && Array.isArray(out.required)) {
		out.required = out.required.filter((name) => Object.hasOwnProperty.call(out.properties, name));
		if (out.required.length === 0) {
			delete out.required;
		}
	}
	return out;
};

/**
 * Operation parameters override path parameters with the same name and location.
 */
let mergeParameters = (doc, pathParams, opParams) => {
	let list = [];
	let index = {};
	[pathParams, opParams].forEach((params) => {
		if (!Array.isArray(params)) {
			return;
		}
		params.forEach((param) => {
			param = deref(doc, param);
			if (!isObject(param) || typeof param.name !== 'string' || typeof param.in !== 'string') {
				return;
			}
			let key = param.in + ':' + param.name;
			if (Object.hasOwnProperty.call(index, key)) {
				list[index[key]] = param;
			} else {
				index[key] = list.length;
				list.push(param);
			}
		});
	});
	return list;
};

let paramSchema = (doc, param) => {
	if (isObject(param.schema)) {
		let schema = resolve(doc, param.schema);
		if (param.description && !schema.description) {
			schema.description = param.description;
		}
		return schema;
	}
	let schema = {};
	SWAGGER2_SCHEMA_KEYS.forEach((key) => {
		if (Object.hasOwnProperty.call(param, key)) {
			schema[key] = param[key];
		}
	});
	return resolve(doc, schema);
};

/**
 * The body schema of an operation and whether the body is required.
 * Swagger 2: the "in: body" parameter, or the "in: formData" parameters.
 * OpenAPI 3: requestBody, JSON first, then form content.
 */
let bodyOf = (doc, params, operation) => {
	let bodyParam = params.find((param) => param.in === 'body');
	if (bodyParam) {
		return {
			"schema": resolve(doc, bodyParam.schema || {}),
			"required": bodyParam.required === true,
			"name": bodyParam.name
		};
	}
	let formParams = params.filter((param) => param.in === 'formData');
	if (formParams.length > 0) {
		let schema = {"type": "object", "properties": {}};
		let required = [];
		formParams.forEach((param) => {
			if (DANGEROUS_KEYS.indexOf(param.name) !== -1) {
				return;
			}
			schema.properties[param.name] = paramSchema(doc, param);
			if (param.required === true) {
				required.push(param.name);
			}
		});
		if (required.length > 0) {
			schema.required = required;
		}
		return {"schema": schema, "required": true, "name": "body"};
	}
	let requestBody = deref(doc, operation.requestBody);
	if (isObject(requestBody) && isObject(requestBody.content)) {
		let types = Object.keys(requestBody.content);
		let type = types.find((t) => t.indexOf('json') !== -1) ||
			types.find((t) => t === 'application/x-www-form-urlencoded' || t === 'multipart/form-data');
		if (type && isObject(requestBody.content[type])) {
			return {
				"schema": resolve(doc, requestBody.content[type].schema || {}),
				"required": requestBody.required === true,
				"name": "body"
			};
		}
	}
	return null;
};

let buildTool = (doc, method, route, pathItem, operation) => {
	let params = mergeParameters(doc, pathItem.parameters, operation.parameters);
	let properties = {};
	let required = [];
	let fields = {};

	let add = (name, schema, where, isRequired) => {
		if (DANGEROUS_KEYS.indexOf(name) !== -1 || Object.hasOwnProperty.call(properties, name)) {
			return;
		}
		properties[name] = schema;
		fields[name] = where;
		if (isRequired) {
			required.push(name);
		}
	};

	// path first, then query, then body: on a name clash the earlier one wins
	params.filter((param) => param.in === 'path').forEach((param) => {
		add(param.name, paramSchema(doc, param), {"in": "params", "path": [param.name]}, true);
	});
	params.filter((param) => param.in === 'query').forEach((param) => {
		add(param.name, paramSchema(doc, param), {"in": "query", "path": [param.name]}, param.required === true);
	});
	let body = bodyOf(doc, params, operation);
	if (body) {
		let schema = body.schema;
		if (isObject(schema) && isObject(schema.properties) && (!schema.type || schema.type === 'object')) {
			let bodyRequired = Array.isArray(schema.required) ? schema.required : [];
			Object.keys(schema.properties).forEach((prop) => {
				add(prop, schema.properties[prop], {"in": "body", "path": [prop]},
					body.required && bodyRequired.indexOf(prop) !== -1);
			});
		} else {
			add(body.name || 'body', isObject(schema) ? schema : {}, {"in": "body", "path": []}, body.required);
		}
	}

	// a path template variable with no parameter declared for it
	let vars = route.match(/\{[^}]+\}/g) || [];
	vars.forEach((v) => {
		let name = v.substring(1, v.length - 1);
		if (!Object.hasOwnProperty.call(fields, name)) {
			add(name, {"type": "string"}, {"in": "params", "path": [name]}, true);
		}
	});

	let inputSchema = {"type": "object", "properties": properties};
	if (required.length > 0) {
		inputSchema.required = required;
	}

	let tool = {
		"m": method,
		"v": route.replace(/\{([^}]+)\}/g, ':$1'),
		"l": operation.summary || operation.description || (method.toUpperCase() + " " + route),
		"inputSchema": inputSchema,
		"fields": fields
	};
	if (Array.isArray(operation.tags) && typeof operation.tags[0] === 'string') {
		tool.group = operation.tags[0];
	}
	if (typeof operation.operationId === 'string') {
		tool.operationId = operation.operationId;
	}
	return tool;
};

/**
 * @param {object} doc a Swagger 2.0 or OpenAPI 3.x document, already parsed (JSON or YAML)
 * @returns {Array} the tools, one per operation on get, post, put and delete
 *
 * Routes are taken as they are in "paths": the gateway puts the service name in front, so
 * basePath and servers are not added.
 */
function fromSwagger(doc) {
	let tools = [];
	if (!isObject(doc) || !isObject(doc.paths)) {
		return tools;
	}
	let isSwagger2 = doc.swagger === '2.0';
	let isOpenAPI3 = typeof doc.openapi === 'string' && doc.openapi.indexOf('3.') === 0;
	if (!isSwagger2 && !isOpenAPI3) {
		return tools;
	}
	Object.keys(doc.paths).forEach((route) => {
		let pathItem = deref(doc, doc.paths[route]);
		if (!isObject(pathItem) || route.charAt(0) !== '/') {
			return;
		}
		METHODS.forEach((method) => {
			if (isObject(pathItem[method])) {
				tools.push(buildTool(doc, method, route, pathItem, pathItem[method]));
			}
		});
	});
	return tools;
}

module.exports = {
	fromSwagger,
	resolve
};
