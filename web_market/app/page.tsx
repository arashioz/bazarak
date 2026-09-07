import BazarekApp from "./components/BazarekApp";
import { Suspense } from "react";

export default function Page() {
  return <Suspense><BazarekApp initialView="landing" /></Suspense>;
}
