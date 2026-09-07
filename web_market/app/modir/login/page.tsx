import BazarekApp from "../../components/BazarekApp";
import { Suspense } from "react";

export default function ManagerLoginPage() {
  return <Suspense><BazarekApp initialView="login" /></Suspense>;
}
