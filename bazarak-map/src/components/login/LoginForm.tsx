
 'use client';
 
 import React, { useState } from 'react';
 import axios from 'axios';
 import { useAuth } from '../../context/AuthContext';
 
 const LoginForm = () => {
   const [username, setUsername] = useState('');
   const [password, setPassword] = useState('');
   const [error, setError] = useState('');
   const { login } = useAuth();
 
   const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     try {
       await login(username, password);
     } catch (err) {
       setError('ورود ناموفق. لطفاً اطلاعات را بررسی کنید.');
     }
   };
 
   return (
     <div className="flex min-h-screen items-center justify-center bg-blush p-5">
       <div className="w-full max-w-sm rounded-3xl border border-oxblood/10 bg-paper p-7 shadow-[0_18px_45px_rgb(87_23_36_/_0.14)]">
         <div className="mb-7 text-center">
           <span className="inline-grid h-12 w-12 place-items-center rounded-2xl bg-oxblood text-xl font-black text-white">ب</span>
           <h2 className="mt-3 text-2xl font-black text-oxblood-dark">نقشه بازارک</h2>
           <p className="mt-1 text-sm text-oxblood/65">ورود به سامانهٔ مسیر و مشتریان</p>
         </div>
         {error && <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
         <form onSubmit={handleSubmit}>
           <div className="mb-4">
             <label className="mb-2 block text-sm font-bold text-oxblood-dark" htmlFor="username">
               نام کاربری
             </label>
             <input
               id="username"
               type="text"
               className="w-full rounded-xl border border-oxblood/15 bg-white px-3 py-2.5 outline-none transition focus:border-oxblood focus:ring-2 focus:ring-oxblood/15"
               value={username}
               onChange={(e) => setUsername(e.target.value)}
               required
             />
           </div>
           <div className="mb-6">
             <label className="mb-2 block text-sm font-bold text-oxblood-dark" htmlFor="password">
               رمز عبور
             </label>
             <input
               id="password"
               type="password"
               className="w-full rounded-xl border border-oxblood/15 bg-white px-3 py-2.5 outline-none transition focus:border-oxblood focus:ring-2 focus:ring-oxblood/15"
               value={password}
               onChange={(e) => setPassword(e.target.value)}
               required
             />
           </div>
           <button
             type="submit"
             className="w-full rounded-xl bg-oxblood px-4 py-3 font-bold text-white shadow-[0_8px_18px_rgb(127_23_36_/_0.24)] transition hover:bg-oxblood-dark"
           >
             ورود
           </button>
         </form>
       </div>
     </div>
   );
 };
 
 export default LoginForm;
