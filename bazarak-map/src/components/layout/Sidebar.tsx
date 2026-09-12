
 'use client';
 
 import React, { useState } from 'react';
 import { Home, Users, Settings, LogOut } from 'lucide-react';
 import { useAuth } from '../../context/AuthContext';
 
 const Sidebar = () => {
   const { user, logout } = useAuth();
   const [activeTab, setActiveTab] = useState('home');
 
   const handleLogout = () => {
     logout();
   };
 
   return (
     <div className="flex w-16 flex-col items-center space-y-8 bg-oxblood py-4 text-white shadow-xl">
       <button
         onClick={() => setActiveTab('home')}
         className={`rounded-xl p-2 ${activeTab === 'home' ? 'bg-white/20' : 'hover:bg-white/10'}`}
         title="خانه"
       >
         <Home size={24} />
       </button>
       
       {user?.role === 'admin' && (
         <>
           <button
             onClick={() => setActiveTab('customers')}
             className={`rounded-xl p-2 ${activeTab === 'customers' ? 'bg-white/20' : 'hover:bg-white/10'}`}
             title="مشتریان"
           >
             <Users size={24} />
           </button>
           <button
             onClick={() => setActiveTab('settings')}
             className={`rounded-xl p-2 ${activeTab === 'settings' ? 'bg-white/20' : 'hover:bg-white/10'}`}
             title="تنظیمات"
           >
             <Settings size={24} />
           </button>
         </>
       )}
       
       <button
         onClick={handleLogout}
         className="mt-auto rounded-xl p-2 hover:bg-white/10"
         title="خروج"
       >
         <LogOut size={24} />
       </button>
     </div>
   );
 };
 
 export default Sidebar;
