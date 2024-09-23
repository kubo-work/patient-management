"use client";
import { usePathname } from "next/navigation";
import DoctorDashboardLayout from "../features/doctor/layout/DoctorDashboardLayout";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  if ("/doctor/login" === pathname) {
    return <>{children}</>;
  } else {
    return <DoctorDashboardLayout>{children}</DoctorDashboardLayout>;
  }
}
