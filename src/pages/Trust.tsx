import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/Logo";
import { ShieldCheck, Lock, Database, UserCheck, FileText, Mail } from "lucide-react";

export default function Trust() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <Link to="/login" className="text-sm text-primary hover:underline font-medium">
            Sign in
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 space-y-10">
        <section className="space-y-3">
          <div className="inline-flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">Trust &amp; Security</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold">How HStack protects your data</h1>
          <p className="text-muted-foreground max-w-3xl">
            This page is maintained by HStack to answer common security and privacy questions
            about the HStack platform. It describes the controls currently enabled in our
            production environment. It is not an independent certification or audit attestation.
          </p>
        </section>

        <Separator />

        <section className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <UserCheck className="h-5 w-5 text-primary" /> Access &amp; Authentication
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Access is restricted to invited employees and authorised collaborators.</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Email + password sign-in, with optional magic-link.</li>
                <li>Role-based access across the 4-tier HStack identity model.</li>
                <li>Server-side session validation on every privileged action.</li>
                <li>Separation-of-duties enforced on approval workflows.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lock className="h-5 w-5 text-primary" /> Platform &amp; Hosting
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                HStack runs on managed cloud infrastructure provided by Lovable Cloud, which uses
                Supabase and PostgreSQL under the hood.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Traffic served over HTTPS/TLS.</li>
                <li>Database access protected with Row-Level Security policies on every table.</li>
                <li>API secrets and service keys held server-side, never in the browser.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5 text-primary" /> Data Collected &amp; How It Is Used
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>HStack stores operational data needed to run construction projects:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Employee profile, attendance and HR records.</li>
                <li>Project, BOQ, measurement, dispatch and site execution data.</li>
                <li>Photos, drawings and voice notes captured against projects.</li>
                <li>Approval, audit and activity logs (with created_by / updated_by stamps).</li>
              </ul>
              <p>Data is used only to operate the platform for HStack and its clients.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-primary" /> Retention &amp; Deletion
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Records are retained for the lifetime of the project for audit purposes. HStack
                uses logical archival (<code>is_archived</code>) rather than hard deletion so
                history remains intact.
              </p>
              <p>
                To request correction or deletion of personal data, contact us using the details
                below.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="h-5 w-5 text-primary" /> Subprocessors &amp; Integrations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <ul className="list-disc pl-5 space-y-1">
                <li>Lovable Cloud / Supabase — application backend, database, auth and storage.</li>
                <li>AI providers accessed via the Lovable AI Gateway for assisted features.</li>
                <li>Email delivery for transactional notifications.</li>
              </ul>
              <p>Integrations only receive the data required to perform the requested function.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5 text-primary" /> Security Contact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                To report a vulnerability or raise a privacy concern, please email{" "}
                <a href="mailto:security@h-stack.com" className="text-primary hover:underline">
                  security@h-stack.com
                </a>
                .
              </p>
              <p>We aim to acknowledge reports within 3 business days.</p>
            </CardContent>
          </Card>
        </section>

        <Separator />

        <section className="text-xs text-muted-foreground space-y-2">
          <p>
            <strong>Shared responsibility.</strong> HStack maintains application-level controls
            described above. The underlying cloud platform provides infrastructure-level
            controls. Customers and end-users are responsible for safeguarding their own
            credentials and for the accuracy of data they enter.
          </p>
          <p>
            This page reflects controls currently enabled in HStack and may be updated as the
            platform evolves. It is not a substitute for a contract or a regulatory certification.
          </p>
        </section>

        <footer className="pt-8 text-sm text-muted-foreground flex flex-wrap gap-4 justify-between">
          <span>© {new Date().getFullYear()} HStack</span>
          <Link to="/login" className="hover:text-foreground">Sign in →</Link>
        </footer>
      </main>
    </div>
  );
}
