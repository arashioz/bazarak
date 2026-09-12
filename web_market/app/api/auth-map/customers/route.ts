 import { NextRequest, NextResponse } from "next/server";
 import { mongoDatabase } from "@/lib/mongodb";
 import { MAP_ADMIN_COOKIE, MAP_DRIVER_COOKIE, isValidMapToken, getMapRole } from "@/app/lib/auth-map-utils";
 
 export async function GET(request: NextRequest) {
   const token = request.cookies.get(MAP_ADMIN_COOKIE)?.value || request.cookies.get(MAP_DRIVER_COOKIE)?.value;
   
   if (!isValidMapToken(token)) {
     return NextResponse.json({ error: "unauthorized" }, { status: 401 });
   }
 
   try {
     const db = await mongoDatabase();
     const collection = db.collection("map_crm_customers");
     
     const typeQuery = request.nextUrl.searchParams.get("type");
     const filter: any = {};
     if (typeQuery) {
       filter.type = typeQuery; // "mobile-service" or "furniture"
     }
 
     const customers = await collection.find(filter).toArray();
     return NextResponse.json(customers);
   } catch (error) {
     return NextResponse.json({ error: "failed to fetch customers" }, { status: 500 });
   }
 }
 
 export async function POST(request: NextRequest) {
   const token = request.cookies.get(MAP_ADMIN_COOKIE)?.value;
   
   // Only admin can add/edit customers
   if (!isValidMapToken(token) || getMapRole(token) !== "admin") {
     return NextResponse.json({ error: "unauthorized" }, { status: 401 });
   }
 
   try {
     const data = await request.json();
     const { name, phone, type, lat, lng, address, metadata } = data;
 
     if (!name || !type || lat === undefined || lng === undefined) {
       return NextResponse.json({ error: "missing required fields" }, { status: 400 });
     }
 
     const db = await mongoDatabase();
     const collection = db.collection("map_crm_customers");
 
     const customerData = {
       name,
       phone,
       type, // "mobile-service" | "furniture"
       location: { lat, lng },
       address,
       metadata: metadata || {},
       updatedAt: new Date()
     };
 
     // If phone exists, update it, otherwise insert new
     if (data.id) {
        await collection.updateOne({ phone }, { $set: customerData });
     } else {
        await collection.insertOne(customerData);
     }
 
     return NextResponse.json({ ok: true });
   } catch (error) {
     console.error(error);
     return NextResponse.json({ error: "failed to save customer" }, { status: 500 });
   }
 }
