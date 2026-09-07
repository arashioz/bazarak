import BazarekApp from "../components/BazarekApp";
import { Suspense } from "react";

export default function ProductsPage() {
  return <Suspense><BazarekApp initialView="user" /></Suspense>;
}
