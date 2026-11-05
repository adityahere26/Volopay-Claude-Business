import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";

export default function Page() {
  return <AuthShell title="Sign in"><AuthForm mode="login" /></AuthShell>;
}
