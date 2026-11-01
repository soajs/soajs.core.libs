'use strict';

/**
 * @license
 * Copyright SOAJS All Rights Reserved.
 *
 * Use of this source code is governed by an Apache license that can be
 * found in the LICENSE file at the root of this repository
 */

let assert = require('assert');
let helper = require("../helper.js");

let mcp = helper.requireModule('./lib/mcp');

describe("testing mcp fromSwagger", function () {

	let swagger2 = {
		"swagger": "2.0",
		"basePath": "/express",
		"parameters": {
			"limit": {"name": "limit", "in": "query", "type": "integer", "maximum": 100}
		},
		"definitions": {
			"Address": {
				"type": "object",
				"properties": {"city": {"type": "string"}},
				"required": ["city"]
			},
			"User": {
				"type": "object",
				"properties": {
					"id": {"type": "string", "readOnly": true},
					"name": {"type": "string"},
					"address": {"$ref": "#/definitions/Address"},
					"manager": {"$ref": "#/definitions/User"}
				},
				"required": ["id", "name"]
			}
		},
		"paths": {
			"/users": {
				"get": {
					"tags": ["users", "admin"],
					"summary": "List users",
					"operationId": "listUsers",
					"parameters": [
						{"$ref": "#/parameters/limit"},
						{"name": "status", "in": "query", "required": true, "type": "string", "enum": ["active", "pending"]},
						{"name": "x-trace", "in": "header", "type": "string"}
					]
				},
				"post": {
					"description": "Create a user",
					"parameters": [
						{"name": "user", "in": "body", "required": true, "schema": {"$ref": "#/definitions/User"}}
					]
				},
				"patch": {"summary": "not routed"}
			},
			"/users/{id}": {
				"parameters": [
					{"name": "id", "in": "path", "required": true, "type": "string"},
					{"name": "fields", "in": "query", "type": "string"}
				],
				"put": {
					"parameters": [
						{"name": "fields", "in": "query", "type": "array", "items": {"type": "string"}, "collectionFormat": "csv"},
						{"name": "tags", "in": "body", "schema": {"type": "array", "items": {"type": "string"}}}
					]
				},
				"delete": {}
			},
			"/upload/{folder}": {
				"post": {
					"parameters": [
						{"name": "file", "in": "formData", "type": "file", "required": true},
						{"name": "note", "in": "formData", "type": "string"}
					]
				}
			}
		}
	};

	let openapi3 = {
		"openapi": "3.0.3",
		"servers": [{"url": "https://api.example.com/v1"}],
		"components": {
			"schemas": {
				"Item": {
					"type": "object",
					"properties": {
						"name": {"type": "string"},
						"price": {"type": "number", "nullable": true, "example": 9.5},
						"children": {"type": "array", "items": {"$ref": "#/components/schemas/Item"}}
					},
					"required": ["name"]
				}
			},
			"requestBodies": {
				"ItemBody": {
					"required": true,
					"content": {"application/json": {"schema": {"$ref": "#/components/schemas/Item"}}}
				}
			}
		},
		"paths": {
			"/items/{itemId}": {
				"get": {
					"summary": "Get an item",
					"parameters": [
						{"name": "itemId", "in": "path", "required": true, "schema": {"type": "integer"}, "description": "The item"},
						{"name": "verbose", "in": "query", "schema": {"type": "boolean", "default": false}}
					]
				},
				"put": {
					"requestBody": {"$ref": "#/components/requestBodies/ItemBody"}
				}
			},
			"/items": {
				"post": {
					"requestBody": {
						"content": {"application/json": {"schema": {"$ref": "#/components/schemas/Item"}}}
					}
				}
			},
			"/forms/{a}/{b}": {
				"post": {
					"parameters": [{"name": "a", "in": "path", "required": true, "schema": {"type": "string"}}],
					"requestBody": {
						"required": true,
						"content": {
							"application/x-www-form-urlencoded": {
								"schema": {"type": "object", "properties": {"q": {"type": "string"}}, "required": ["q"]}
							}
						}
					}
				}
			}
		}
	};

	let find = (tools, m, v) => {
		return tools.find((tool) => tool.m === m && tool.v === v);
	};

	describe("swagger 2.0", function () {
		let tools = mcp.fromSwagger(swagger2);

		it("one tool per get, post, put and delete operation, paths without basePath", function (done) {
			assert.deepStrictEqual(tools.map((tool) => tool.m + " " + tool.v), [
				"get /users",
				"post /users",
				"put /users/:id",
				"delete /users/:id",
				"post /upload/:folder"
			]);
			done();
		});

		it("query parameters, parameter refs, headers left out, label, group and operationId", function (done) {
			assert.deepStrictEqual(find(tools, "get", "/users"), {
				"m": "get",
				"v": "/users",
				"l": "List users",
				"group": "users",
				"operationId": "listUsers",
				"inputSchema": {
					"type": "object",
					"properties": {
						"limit": {"type": "integer", "maximum": 100},
						"status": {"type": "string", "enum": ["active", "pending"]}
					},
					"required": ["status"]
				},
				"fields": {
					"limit": {"in": "query", "path": ["limit"]},
					"status": {"in": "query", "path": ["status"]}
				}
			});
			done();
		});

		it("body object spread into fields, refs resolved, readOnly left out, recursion stopped", function (done) {
			let tool = find(tools, "post", "/users");
			assert.deepStrictEqual(tool.l, "Create a user");
			assert.deepStrictEqual(tool.fields, {
				"name": {"in": "body", "path": ["name"]},
				"address": {"in": "body", "path": ["address"]},
				"manager": {"in": "body", "path": ["manager"]}
			});
			assert.deepStrictEqual(tool.inputSchema.required, ["name"]);
			assert.deepStrictEqual(tool.inputSchema.properties.address, {
				"type": "object",
				"properties": {"city": {"type": "string"}},
				"required": ["city"]
			});
			// User is already being resolved, so its reference to itself stops here
			assert.deepStrictEqual(tool.inputSchema.properties.manager, {});
			done();
		});

		it("path-level parameters, operation override, a non-object body is the whole body", function (done) {
			let tool = find(tools, "put", "/users/:id");
			assert.deepStrictEqual(tool.inputSchema, {
				"type": "object",
				"properties": {
					"id": {"type": "string"},
					"fields": {"type": "array", "items": {"type": "string"}},
					"tags": {"type": "array", "items": {"type": "string"}}
				},
				"required": ["id"]
			});
			assert.deepStrictEqual(tool.fields, {
				"id": {"in": "params", "path": ["id"]},
				"fields": {"in": "query", "path": ["fields"]},
				"tags": {"in": "body", "path": []}
			});
			let del = find(tools, "delete", "/users/:id");
			assert.deepStrictEqual(del.l, "DELETE /users/{id}");
			assert.deepStrictEqual(del.inputSchema.required, ["id"]);
			done();
		});

		it("formData becomes body fields, file is a string, undeclared path variable added", function (done) {
			let tool = find(tools, "post", "/upload/:folder");
			assert.deepStrictEqual(tool.inputSchema, {
				"type": "object",
				"properties": {
					"file": {"type": "string"},
					"note": {"type": "string"},
					"folder": {"type": "string"}
				},
				"required": ["file", "folder"]
			});
			assert.deepStrictEqual(tool.fields.folder, {"in": "params", "path": ["folder"]});
			done();
		});
	});

	describe("openapi 3", function () {
		let tools = mcp.fromSwagger(openapi3);

		it("path and query parameters with schema, description and default", function (done) {
			let tool = find(tools, "get", "/items/:itemId");
			assert.deepStrictEqual(tool.inputSchema, {
				"type": "object",
				"properties": {
					"itemId": {"type": "integer", "description": "The item"},
					"verbose": {"type": "boolean", "default": false}
				},
				"required": ["itemId"]
			});
			done();
		});

		it("requestBody ref, required body keeps the schema's required, nullable, example dropped", function (done) {
			let tool = find(tools, "put", "/items/:itemId");
			// itemId is not declared on put, it is added after the body fields
			assert.deepStrictEqual(tool.inputSchema.required, ["name", "itemId"]);
			assert.deepStrictEqual(tool.inputSchema.properties.price, {"type": ["number", "null"]});
			assert.deepStrictEqual(tool.inputSchema.properties.children, {"type": "array", "items": {}});
			assert.deepStrictEqual(tool.fields.name, {"in": "body", "path": ["name"]});
			done();
		});

		it("an optional body makes none of its properties required", function (done) {
			let tool = find(tools, "post", "/items");
			assert.ok(!tool.inputSchema.required);
			assert.deepStrictEqual(Object.keys(tool.fields), ["name", "price", "children"]);
			done();
		});

		it("form content and an undeclared path variable", function (done) {
			let tool = find(tools, "post", "/forms/:a/:b");
			assert.deepStrictEqual(tool.inputSchema.required, ["a", "q", "b"]);
			assert.deepStrictEqual(tool.fields, {
				"a": {"in": "params", "path": ["a"]},
				"q": {"in": "body", "path": ["q"]},
				"b": {"in": "params", "path": ["b"]}
			});
			done();
		});

		it("the document is not changed", function (done) {
			assert.deepStrictEqual(openapi3.components.schemas.Item.properties.price, {"type": "number", "nullable": true, "example": 9.5});
			done();
		});
	});

	describe("edge cases", function () {
		it("not a swagger 2.0 or openapi 3 document", function (done) {
			assert.deepStrictEqual(mcp.fromSwagger(null), []);
			assert.deepStrictEqual(mcp.fromSwagger({}), []);
			assert.deepStrictEqual(mcp.fromSwagger({"swagger": "1.2", "paths": {"/a": {"get": {}}}}), []);
			assert.deepStrictEqual(mcp.fromSwagger({"openapi": "2.0", "paths": {"/a": {"get": {}}}}), []);
			done();
		});

		it("refs that do not resolve or loop, and dangerous keys", function (done) {
			let doc = JSON.parse('{"openapi": "3.1.0", "components": {"schemas": {"A": {"$ref": "#/components/schemas/B"}, "B": {"$ref": "#/components/schemas/A"}}}, "paths": {"/a/{x}": {"post": {' +
				'"parameters": [{"$ref": "#/components/parameters/missing"}, {"name": "__proto__", "in": "query", "schema": {"type": "string"}}],' +
				'"requestBody": {"content": {"application/json": {"schema": {"type": "object", "properties": {' +
				'"loop": {"$ref": "#/components/schemas/A"}, "gone": {"$ref": "#/__proto__/x"}, "__proto__": {"type": "string"}, "ok": {"type": "string"}}}}}}}}}}');
			let tools = mcp.fromSwagger(doc);
			assert.deepStrictEqual(tools[0].inputSchema, {
				"type": "object",
				"properties": {
					"x": {"type": "string"},
					"loop": {},
					"gone": {},
					"ok": {"type": "string"}
				},
				"required": ["x"]
			});
			done();
		});
	});
});
