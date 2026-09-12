
 'use client';
 
 import React from 'react';
 import MapView from '../components/map/MapView';
 import Sidebar from '../components/layout/Sidebar';
 import CustomerList from '../components/customers/CustomerList';
 
 export default function Home() {
   return (
     <main className="flex min-h-screen bg-blush">
       <Sidebar />
       <div className="flex flex-1 flex-col md:flex-row">
         <div className="w-full border-b border-oxblood/10 bg-paper p-4 md:w-1/3 md:border-b-0 md:border-l lg:w-1/4">
           <h1 className="mb-4 text-xl font-black text-oxblood">مشتریان روی نقشه</h1>
           <CustomerList />
         </div>
         <div className="min-h-[65vh] flex-1 md:min-h-screen">
           <MapView />
         </div>
       </div>
     </main>
   );
 }
