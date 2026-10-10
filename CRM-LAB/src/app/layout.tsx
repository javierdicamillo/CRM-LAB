import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'CRM-LAB · Gestión inmobiliaria',description:'Tu inmobiliaria, en un solo lugar.',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="es-AR"><body>{children}</body></html>;}
