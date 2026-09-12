 import { NextRequest, NextResponse } from "next/server";
 import { mongoDatabase } from "@/lib/mongodb";
 import { MAP_ADMIN_COOKIE, isValidMapToken } from "@/app/lib/auth-map-utils";
 
 export async function GET(request: NextRequest) {
   if (!isValidMapToken(request.cookies.get(MAP_ADMIN_COOKIE)?.value)) {
     return NextResponse.json({ error: "unauthorized" }, { status: 401 });
   }
 
   try {
     const db = await mongoDatabase();
     // We use a separate collection for settings to keep it clean
     const settings = await db.collection("map_crm_settings").findOne({ _id: "primary_settings" });
     return NextResponse.json(settings || { defaultCity: "" });
   } catch (error) {
     return NextResponse.json({ error: "failed to fetch settings" }, { status: 500 });
   }
 }
 
 export async function PUT(request: NextRequest) {
   if (!isValidMapToken(request.cookies.get(MAP_ADMIN_COOKIE)?.value)) {
     return NextResponse.json({ error: "unauthorized" }, { status: 401 });
   }
 
   try {
     const data = await request.json();
     const db = await mongoDatabase();
     
     await db.collection("map_crm_settings").updateOne(
       { _id: "primary_settings" },
       { $set: { ...data, updatedAt: new Date() } },
       { upsert: true }
     );
 
     return NextResponse.json({ ok: true });
   } catch (error) {
     return NextResponse.json({ error: "failed to update settings" }, { status: 500 });
   }
 }