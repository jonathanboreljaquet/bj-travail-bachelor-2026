"use client";

import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui";

export default function LogoutButton() {
  return (
    <Button variant="ghost" className="text-xs" onClick={() => logoutAction()}>
      Déconnexion
    </Button>
  );
}
