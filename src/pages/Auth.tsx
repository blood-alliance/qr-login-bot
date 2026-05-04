import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";

export default function Auth() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/connection" replace />;

  const signIn = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate("/connection");
  };

  const signUp = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + "/connection" },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created. Check your email to confirm, then sign in.");
  };

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-[image:var(--gradient-subtle)]">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="size-14 rounded-2xl bg-[image:var(--gradient-primary)] grid place-items-center text-primary-foreground shadow-[var(--shadow-elegant)]">
            <MessageCircle className="size-7" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">WhatsApp Bot Dashboard</h1>
            <p className="text-sm text-muted-foreground">Pair your WhatsApp via QR and let AI handle replies.</p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Sign in or create an account to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>
              <div className="space-y-3 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <TabsContent value="signin" className="m-0">
                  <Button className="w-full" onClick={signIn} disabled={busy}>
                    Sign in
                  </Button>
                </TabsContent>
                <TabsContent value="signup" className="m-0">
                  <Button className="w-full" onClick={signUp} disabled={busy}>
                    Create account
                  </Button>
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
