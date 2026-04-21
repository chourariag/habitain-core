import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle, ArrowRight, PartyPopper } from "lucide-react";
import { getOnboardingForRole, type OnboardingFeature, type RoleOnboarding } from "@/lib/onboarding-data";
import { ROLE_LABELS } from "@/lib/roles";
import { insertNotifications } from "@/lib/notifications";

type Phase = "welcome" | "feature" | "quiz" | "practice" | "complete";

export default function Onboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("");
  const [onboarding, setOnboarding] = useState<RoleOnboarding | null>(null);

  const [phase, setPhase] = useState<Phase>("welcome");
  const [featureIdx, setFeatureIdx] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<(number | null)[]>([null, null, null]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScores, setQuizScores] = useState<Record<string, number>>({});
  const [practiceAcked, setPracticeAcked] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login", { replace: true }); return; }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, display_name, role, onboarding_completed")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!profile) { navigate("/dashboard", { replace: true }); return; }
      if (profile.onboarding_completed) { navigate("/dashboard", { replace: true }); return; }

      setProfileId(profile.id);
      setDisplayName(profile.display_name || user.email?.split("@")[0] || "there");
      setRole(profile.role || "");
      setOnboarding(getOnboardingForRole(profile.role || ""));
      setLoading(false);
    })();
  }, [navigate]);

  if (loading || !onboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalFeatures = onboarding.features.length;
  const currentFeature: OnboardingFeature | null = onboarding.features[featureIdx] ?? null;

  // Progress: each feature has 3 sub-phases (feature, quiz, practice)
  const stepsPerFeature = 3;
  const totalSteps = totalFeatures * stepsPerFeature;
  const currentStep =
    phase === "welcome" ? 0
      : phase === "complete" ? totalSteps
        : featureIdx * stepsPerFeature + (phase === "feature" ? 0 : phase === "quiz" ? 1 : 2);
  const progressPct = Math.round((currentStep / totalSteps) * 100);

  const roleLabel = ROLE_LABELS[role as keyof typeof ROLE_LABELS] || role;

  // Quiz logic
  const quizPassed = () => {
    if (!currentFeature) return false;
    let correct = 0;
    currentFeature.quiz.forEach((q, i) => {
      if (quizAnswers[i] === q.correctIndex) correct++;
    });
    return correct >= 2;
  };

  const handleQuizSubmit = () => {
    if (quizAnswers.some((a) => a === null)) {
      toast.error("Please answer all questions");
      return;
    }
    setQuizSubmitted(true);
    if (currentFeature) {
      let correct = 0;
      currentFeature.quiz.forEach((q, i) => {
        if (quizAnswers[i] === q.correctIndex) correct++;
      });
      setQuizScores((prev) => ({ ...prev, [currentFeature.name]: correct }));
    }
  };

  const handleQuizRetry = () => {
    setQuizAnswers([null, null, null]);
    setQuizSubmitted(false);
    setPhase("feature"); // replay feature
  };

  const advanceToNextFeature = () => {
    if (featureIdx + 1 < totalFeatures) {
      setFeatureIdx(featureIdx + 1);
      setQuizAnswers([null, null, null]);
      setQuizSubmitted(false);
      setPracticeAcked(false);
      setPhase("feature");
    } else {
      setPhase("complete");
    }
  };

  const handleComplete = async () => {
    if (!profileId) return;
    setLoading(true);

    await supabase
      .from("profiles")
      .update({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        onboarding_quiz_scores: quizScores,
      } as any)
      .eq("id", profileId);

    // Notify HOD
    const { data: hods } = await supabase
      .from("profiles")
      .select("id")
      .in("role", ["production_head", "head_operations", "managing_director", "super_admin"])
      .eq("is_active", true);

    if (hods?.length) {
      await insertNotifications(
        hods.map((h) => ({
          recipient_id: h.id,
          title: "Onboarding Completed",
          body: `${displayName} has completed HStack onboarding and passed all feature quizzes.`,
          category: "system",
        }))
      );
    }

    toast.success("Onboarding complete!");
    navigate("/dashboard", { replace: true });
  };

  // ─── RENDER PHASES ───

  const roleSteps = getRoleFirstSteps(role);

  if (phase === "welcome") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto h-14 w-14 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-2xl">
              H
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Welcome to HStack — your role is {roleLabel}
            </h1>
            <p className="text-muted-foreground text-sm">
              Here is what to do first:
            </p>
          </div>

          {roleSteps.length > 0 && (
            <div className="space-y-2">
              {roleSteps.map((step, i) => (
                <button
                  key={i}
                  onClick={() => navigate(step.to)}
                  className="w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors flex items-start gap-3"
                >
                  <span className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: "#E8F2ED", color: "#006039" }}>
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{step.label}</p>
                    <p className="text-xs text-muted-foreground">{step.sublabel}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 mt-0.5 ml-auto shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}

          <Progress value={0} className="h-2" />
          <p className="text-center text-xs text-muted-foreground">Complete these steps to get started</p>

          <Button className="w-full gap-2" onClick={() => setPhase("feature")}>
            Start Training <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "complete") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <div className="w-full max-w-md space-y-6 text-center">
          <PartyPopper className="h-16 w-16 mx-auto text-primary animate-bounce" />
          <h1 className="font-display text-2xl font-bold text-foreground">
            You've completed HStack onboarding!
          </h1>
          <p className="text-muted-foreground text-sm">
            Your HOD has been notified. You're ready to start using HStack.
          </p>
          <Progress value={100} className="h-2" />
          <Button className="w-full gap-2" onClick={handleComplete}>
            Start Using HStack <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (!currentFeature) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Top progress */}
      <div className="sticky top-0 z-20 bg-background border-b border-border px-4 py-3">
        <div className="max-w-2xl mx-auto space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Feature {featureIdx + 1} of {totalFeatures}</span>
            <span>{progressPct}% complete</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* ─── FEATURE WALKTHROUGH ─── */}
        {phase === "feature" && (
          <>
            <h2 className="font-display text-xl font-bold" style={{ color: "#006039" }}>
              {currentFeature.name}
            </h2>

            <Card>
              <CardContent className="p-5 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">What it does</p>
                  <p className="text-sm text-foreground">{currentFeature.whatItDoes}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Why it matters for your job</p>
                  <p className="text-sm text-foreground">{currentFeature.whyItMatters}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">How to use it</p>
                  <ol className="list-decimal list-inside space-y-1">
                    {currentFeature.howToUse.map((step, i) => (
                      <li key={i} className="text-sm text-foreground">{step}</li>
                    ))}
                  </ol>
                </div>
              </CardContent>
            </Card>

            <Button className="w-full gap-2" onClick={() => setPhase("quiz")}>
              Take Quiz <ArrowRight className="h-4 w-4" />
            </Button>
          </>
        )}

        {/* ─── QUIZ ─── */}
        {phase === "quiz" && (
          <>
            <h2 className="font-display text-xl font-bold" style={{ color: "#006039" }}>
              Quiz — {currentFeature.name}
            </h2>
            <p className="text-sm text-muted-foreground">Answer at least 2 out of 3 correctly to proceed.</p>

            <div className="space-y-4">
              {currentFeature.quiz.map((q, qi) => (
                <Card key={qi} className={quizSubmitted ? (quizAnswers[qi] === q.correctIndex ? "border-green-500" : "border-destructive") : ""}>
                  <CardContent className="p-4 space-y-3">
                    <p className="text-sm font-medium text-foreground">
                      {qi + 1}. {q.question}
                    </p>
                    <div className="space-y-2">
                      {q.options.map((opt, oi) => {
                        const selected = quizAnswers[qi] === oi;
                        const isCorrect = q.correctIndex === oi;
                        let variant: "outline" | "default" | "destructive" = "outline";
                        if (quizSubmitted && selected && isCorrect) variant = "default";
                        else if (quizSubmitted && selected && !isCorrect) variant = "destructive";
                        else if (quizSubmitted && isCorrect) variant = "default";
                        else if (selected) variant = "default";

                        return (
                          <Button
                            key={oi}
                            variant={variant}
                            className="w-full justify-start text-left h-auto py-2 px-3 text-sm"
                            disabled={quizSubmitted}
                            onClick={() => {
                              const next = [...quizAnswers];
                              next[qi] = oi;
                              setQuizAnswers(next);
                            }}
                          >
                            {quizSubmitted && isCorrect && <CheckCircle className="h-4 w-4 mr-2 shrink-0" />}
                            {quizSubmitted && selected && !isCorrect && <XCircle className="h-4 w-4 mr-2 shrink-0" />}
                            {opt}
                          </Button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {!quizSubmitted ? (
              <Button className="w-full" onClick={handleQuizSubmit}>Submit Answers</Button>
            ) : quizPassed() ? (
              <div className="space-y-3">
                <div className="rounded-md p-3 flex items-center gap-2" style={{ backgroundColor: "#E8F2ED" }}>
                  <CheckCircle className="h-5 w-5" style={{ color: "#006039" }} />
                  <p className="text-sm font-display font-bold" style={{ color: "#006039" }}>Passed! Let's practice.</p>
                </div>
                <Button className="w-full gap-2" onClick={() => { setPracticeAcked(false); setPhase("practice"); }}>
                  Continue to Practice Task <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-md p-3 flex items-center gap-2" style={{ backgroundColor: "#FFF0F0" }}>
                  <XCircle className="h-5 w-5" style={{ color: "#F40009" }} />
                  <p className="text-sm font-display font-bold" style={{ color: "#F40009" }}>
                    Not quite — let's review and try again.
                  </p>
                </div>
                <Button className="w-full" variant="outline" onClick={handleQuizRetry}>
                  Replay Feature & Retry Quiz
                </Button>
              </div>
            )}
          </>
        )}

        {/* ─── PRACTICE TASK ─── */}
        {phase === "practice" && (
          <>
            <h2 className="font-display text-xl font-bold" style={{ color: "#006039" }}>
              Practice Task — {currentFeature.name}
            </h2>

            <Card className="border-primary">
              <CardContent className="p-5 space-y-3">
                <p className="text-sm font-medium text-foreground">{currentFeature.practiceTask}</p>
                <Badge variant="secondary" className="text-xs">
                  Navigate to {currentFeature.practiceRoute}
                </Badge>
              </CardContent>
            </Card>

            {!practiceAcked ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground text-center">
                  Complete the task above, then confirm below.
                </p>
                <Button className="w-full" onClick={() => setPracticeAcked(true)}>
                  I've Completed This Task
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-md p-3 flex items-center gap-2" style={{ backgroundColor: "#E8F2ED" }}>
                  <CheckCircle className="h-5 w-5" style={{ color: "#006039" }} />
                  <p className="text-sm font-display font-bold" style={{ color: "#006039" }}>Great work!</p>
                </div>
                <Button className="w-full gap-2" onClick={advanceToNextFeature}>
                  {featureIdx + 1 < totalFeatures ? "Next Feature" : "Complete Onboarding"} <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
