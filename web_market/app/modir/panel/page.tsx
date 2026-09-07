import BazarekApp from "../../components/BazarekApp";
import { Suspense } from "react";

export default function ManagerPanelPage() {
  return <Suspense><BazarekApp initialView="admin" /></Suspense>;
}
