import BazarekApp from "../../components/BazarekApp";
import { Suspense } from "react";

export default function CategoryCatalogPage() {
  return <Suspense><BazarekApp initialView="catalog" /></Suspense>;
}
