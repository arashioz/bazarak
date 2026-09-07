import BazarekApp from "../components/BazarekApp";
import { Suspense } from "react";

export default function CatalogPage() {
  return <Suspense><BazarekApp initialView="catalog" /></Suspense>;
}
