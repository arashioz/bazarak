module.exports = [
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/action-async-storage.external.js [external] (next/dist/server/app-render/action-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/action-async-storage.external.js", () => require("next/dist/server/app-render/action-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/runtime-reacts.external.js [external] (next/dist/server/runtime-reacts.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/server/runtime-reacts.external.js", () => require("next/dist/server/runtime-reacts.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/node:stream [external] (node:stream, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("node:stream", () => require("node:stream"));

module.exports = mod;
}),
"[project]/src/app/api/map-data/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "PUT",
    ()=>PUT,
    "runtime",
    ()=>runtime
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$database$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/database.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$map$2d$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/map-auth.ts [app-route] (ecmascript)");
;
;
;
const runtime = "nodejs";
const mapRole = (request)=>{
    const token = request.cookies.get(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$map$2d$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["MAP_ADMIN_COOKIE"])?.value || request.cookies.get(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$map$2d$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["MAP_DRIVER_COOKIE"])?.value;
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$map$2d$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isValidMapToken"])(token) ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$map$2d$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getMapRole"])(token) : null;
};
async function GET(request) {
    if (!mapRole(request)) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        error: "unauthorized"
    }, {
        status: 401
    });
    try {
        const state = await (await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$database$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["mapDatabase"])()).collection("appState").findOne({
            _id: "primary"
        }, {
            projection: {
                customers: 1,
                mobileServices: 1
            }
        });
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            customers: Array.isArray(state?.customers) ? state.customers : [],
            mobileServices: state?.mobileServices || {
                records: [],
                serviceTypes: [],
                operators: []
            }
        });
    } catch  {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "database unavailable"
        }, {
            status: 503
        });
    }
}
async function PUT(request) {
    if (mapRole(request) !== "admin") return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        error: "admin access required"
    }, {
        status: 403
    });
    try {
        const body = await request.json();
        const collection = (await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$database$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["mapDatabase"])()).collection("appState");
        if (body.section === "customer" && Number.isFinite(Number(body.data?.id))) {
            const id = Number(body.data?.id);
            const result = await collection.updateOne({
                _id: "primary",
                "customers.id": id
            }, {
                $set: {
                    "customers.$": body.data,
                    updatedAt: new Date()
                }
            });
            if (!result.matchedCount) await collection.updateOne({
                _id: "primary"
            }, {
                $push: {
                    customers: body.data
                },
                $set: {
                    updatedAt: new Date()
                }
            }, {
                upsert: true
            });
        } else if (body.section === "mobileServices" && body.data) {
            await collection.updateOne({
                _id: "primary"
            }, {
                $set: {
                    mobileServices: body.data,
                    updatedAt: new Date()
                }
            }, {
                upsert: true
            });
        } else {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: "invalid request"
            }, {
                status: 400
            });
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ok: true
        });
    } catch  {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "database update failed"
        }, {
            status: 500
        });
    }
}
}),
"[project]/src/lib/database.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "mapDatabase",
    ()=>mapDatabase
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$mongodb__$5b$external$5d$__$28$mongodb$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f$mongodb$29$__ = __turbopack_context__.i("[externals]/mongodb [external] (mongodb, cjs, [project]/node_modules/mongodb)");
;
// Match the web_market backend exactly. In Docker both apps receive the same
// MONGODB_URI; its fallback resolves the Compose service named `mongo`.
const uri = ()=>process.env.MONGODB_URI || "mongodb://mongo:27017/bazarek";
const mapDatabase = async ()=>{
    /*TURBOPACK member replacement*/ __turbopack_context__.g.bazarakMapMongoClient ||= new __TURBOPACK__imported__module__$5b$externals$5d2f$mongodb__$5b$external$5d$__$28$mongodb$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f$mongodb$29$__["MongoClient"](uri()).connect();
    return /*TURBOPACK member replacement*/ __turbopack_context__.g.bazarakMapMongoClient.then((client)=>client.db(process.env.MONGODB_DB || "bazarek"));
};
}),
"[project]/src/lib/map-auth.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MAP_ADMIN_COOKIE",
    ()=>MAP_ADMIN_COOKIE,
    "MAP_DRIVER_COOKIE",
    ()=>MAP_DRIVER_COOKIE,
    "createMapToken",
    ()=>createMapToken,
    "getMapRole",
    ()=>getMapRole,
    "isValidMapToken",
    ()=>isValidMapToken
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/crypto [external] (crypto, cjs)");
;
const MAP_ADMIN_COOKIE = "bazarek_map_admin_token";
const MAP_DRIVER_COOKIE = "bazarek_map_driver_token";
const secret = ()=>process.env.MAP_SESSION_SECRET || "change-this-map-session-secret";
const signature = (value)=>(0, __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__["createHmac"])("sha256", secret()).update(value).digest("base64url");
const createMapToken = (role)=>{
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(JSON.stringify({
        sub: role,
        iat: now,
        exp: now + 60 * 60 * 12
    })).toString("base64url");
    return `${payload}.${signature(payload)}`;
};
const payloadFor = (token)=>{
    if (!token) return null;
    const [payload, receivedSignature] = token.split(".");
    if (!payload || !receivedSignature) return null;
    const expected = Buffer.from(signature(payload));
    const received = Buffer.from(receivedSignature);
    if (expected.length !== received.length || !(0, __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__["timingSafeEqual"])(expected, received)) return null;
    try {
        const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        return decoded.exp > Math.floor(Date.now() / 1000) ? decoded : null;
    } catch  {
        return null;
    }
};
const isValidMapToken = (token)=>Boolean(payloadFor(token));
const getMapRole = (token)=>payloadFor(token)?.sub || null;
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0k43yfv._.js.map