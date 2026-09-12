
 'use client';
 
 import React from 'react';
 import './globals.css';
 import { AuthProvider } from '../context/AuthContext';
 import LoginForm from '../components/login/LoginForm';
 import { useAuth } from '../context/AuthContext';
 
 export default function RootLayout({
   children,
 }: {
   children: React.ReactNode;
 }) {
   return (
     <html lang="fa" dir="rtl">
       <body>
         <AuthProvider>
           <ConditionalRender>{children}</ConditionalRender>
         </AuthProvider>
       </body>
     </html>
   );
 }
 
 const ConditionalRender = ({ children }: { children: React.ReactNode }) => {
   const { user, loading } = useAuth();
 
   if (loading) {
     return <div>در حال بارگذاری...</div>;
   }
 
   if (!user) {
     return <LoginForm />;
   }
 
   return <>{children}</>;
 };
