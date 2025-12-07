import { Metadata } from "next"
import { Button } from "components/Button/Button"

export const metadata: Metadata = {
  title: "Tempora AI | Student-friendly scheduling without the back-and-forth",
  description: "Tempora AI is the student scheduling copilot that learns your habits, protects focus time, and keeps you on top of deadlines.",
  openGraph: {
    title: "Tempora AI | Student-friendly scheduling without the back-and-forth",
    description: "Tempora AI is the student scheduling copilot that learns your habits, protects focus time, and keeps you on top of deadlines.",
    url: "https://tempora-ai.vercel.app/",
    images: [
      {
        width: 1200,
        height: 630,
        url: "https://tempora-ai.vercel.app/og.png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tempora AI | Student-friendly scheduling without the back-and-forth",
    description: "Tempora AI is the student scheduling copilot that learns your habits, protects focus time, and keeps you on top of deadlines.",
  },
}

const featureHighlights = [
  {
    title: "Keeps classes and life in sync",
    description: "Imports classes, labs, and clubs, then balances them with the rest of your commitments.",
  },
  {
    title: "Protects study time",
    description: "Blocks focus hours around exams and assignments so you actually get deep work done.",
  },
  {
    title: "Reminds and reschedules fast",
    description: "Gets you ahead of deadlines with nudges, and moves things when plans change.",
  },
]

const workflow = [
  "Connect your school calendar and import your syllabi in minutes.",
  "Tell the copilot your goals (study hours, club nights, workouts) and let it place the blocks.",
  "Ask for a weekly plan, quick reschedules, or reminders before every big deadline.",
]

export default function Web() {
  return (
    <main className="bg-white text-slate-900">
      <section className="relative overflow-hidden px-6 py-20 md:py-28">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#ecf9f0,_#ffffff_55%)]" />
        <div className="absolute left-1/2 top-1/3 -z-10 h-80 w-80 -translate-x-1/2 rounded-full bg-[#66cc8a]/30 blur-3xl" />
        <div className="mx-auto flex max-w-6xl flex-col gap-14 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-6">
            <div className="inline-flex items-center gap-3 rounded-full border border-[#66cc8a]/40 bg-[#66cc8a]/10 px-4 py-2 text-sm font-medium text-[var(--color-primary-400)]">
              <span className="h-2 w-2 rounded-full bg-[#66cc8a]" aria-hidden />
              Tempora Copilot is live in beta
            </div>
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.3em] text-[var(--color-primary-700)]">Student scheduling copilot</p>
              <h1 className="text-4xl font-black leading-tight tracking-tight md:text-5xl">
                Let Tempora organize classes, study time, and life without the stress.
              </h1>
              <p className="text-lg text-slate-600 md:text-xl">
                Set your goals once and the copilot builds a balanced week for you: classes, labs, clubs, workouts,
                study blocks, and breathing room.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button href="/signup" className="sm:w-fit">
                Start free as a student
              </Button>
              <Button href="/login" intent="secondary" className="sm:w-fit">
                Log in to your account
              </Button>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-slate-700">
              <div className="rounded-lg border border-[var(--color-primary-200)] bg-white/80 px-4 py-3 shadow-sm shadow-[rgba(102,204,138,0.15)]">
                <p className="font-semibold text-slate-900">Class-aware</p>
                <p className="text-slate-600">Syncs classes and keeps conflicts out of your day.</p>
              </div>
              <div className="rounded-lg border border-[var(--color-primary-200)] bg-white/80 px-4 py-3 shadow-sm shadow-[rgba(102,204,138,0.15)]">
                <p className="font-semibold text-slate-900">Focus-first</p>
                <p className="text-slate-600">Protects study blocks and reminders ahead of exams.</p>
              </div>
            </div>
          </div>
          <div className="flex w-full max-w-xl flex-col gap-4 rounded-2xl border border-[var(--color-primary-200)] bg-white p-8 shadow-2xl shadow-[rgba(102,204,138,0.15)]">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <p>Next available windows</p>
              <span className="rounded-full bg-[#66cc8a]/20 px-3 py-1 text-[var(--color-primary-700)]">
                Auto-held
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-left text-sm text-slate-800">
              <div className="rounded-xl border border-[var(--color-primary-100)] bg-[rgba(236,249,240,0.8)] p-4">
                <p className="text-xs uppercase text-[var(--color-primary-500)]">Today</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">2:00 PM - 3:30 PM</p>
                <p className="text-slate-600">Study block + review flashcards</p>
              </div>
              <div className="rounded-xl border border-[var(--color-primary-100)] bg-[rgba(236,249,240,0.8)] p-4">
                <p className="text-xs uppercase text-[var(--color-primary-500)]">Tomorrow</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">9:30 AM - 11:00 AM</p>
                <p className="text-slate-600">CS lecture + notes prep</p>
              </div>
              <div className="rounded-xl border border-[var(--color-primary-100)] bg-[rgba(236,249,240,0.8)] p-4">
                <p className="text-xs uppercase text-[var(--color-primary-500)]">Thursday</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">1:00 PM - 2:30 PM</p>
                <p className="text-slate-600">Group project work time</p>
              </div>
              <div className="rounded-xl border border-[var(--color-primary-100)] bg-[rgba(236,249,240,0.8)] p-4">
                <p className="text-xs uppercase text-[var(--color-primary-500)]">Friday</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">10:00 AM - 11:30 AM</p>
                <p className="text-slate-600">Club leadership meeting</p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-[var(--color-primary-100)] bg-white px-4 py-3 text-sm text-slate-700">
              <div>
                <p className="font-semibold text-slate-900">Tempora Copilot</p>
                <p>"I moved your study block so it does not overlap with lab—ready to start at 4:00 PM."</p>
              </div>
              <span className="inline-flex items-center justify-center rounded-full bg-[#66cc8a]/20 px-4 py-1 text-[var(--color-primary-800)]">
                Audit ready
              </span>
            </div>
          </div>
        </div>
      </section>
      <section className="border-t border-[var(--color-primary-100)] bg-[#f7fbf8] px-6 py-16 md:py-20">
        <div className="mx-auto max-w-6xl space-y-12">
          <div className="flex flex-col gap-3">
            <p className="text-sm uppercase tracking-[0.25em] text-[var(--color-primary-700)]">Built for students</p>
            <h2 className="text-3xl font-semibold md:text-4xl">Own your semester with a calm, clear schedule.</h2>
            <p className="max-w-3xl text-lg text-slate-600">
              Tempora pairs a friendly copilot with a clean calendar so you can balance classes, study time, campus life,
              and rest without the scramble.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {featureHighlights.map((item) => (
              <div
                key={item.title}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--color-primary-100)] bg-white p-6 shadow-lg shadow-[rgba(102,204,138,0.12)]"
              >
                <div className="h-10 w-10 rounded-full bg-[#66cc8a]/20 ring-1 ring-[#54a872]/40" />
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">{item.title}</h3>
                  <p className="text-slate-600">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-8 rounded-2xl border border-[var(--color-primary-100)] bg-white p-8 shadow-xl shadow-[rgba(102,204,138,0.12)] lg:grid-cols-[1.1fr,0.9fr] lg:items-center">
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.2em] text-[var(--color-primary-700)]">How Tempora works</p>
              <h3 className="text-2xl font-semibold">Tell it your plan—Tempora builds the week around it.</h3>
              <p className="text-slate-600">
                Every class, study block, and activity stays inside the guardrails you set: focus hours, travel time, and
                real deadlines.
              </p>
              <div className="space-y-3">
                {workflow.map((step, index) => (
                  <div
                    key={step}
                    className="flex items-start gap-3 rounded-xl border border-[var(--color-primary-100)] bg-[rgba(236,249,240,0.7)] px-4 py-3"
                  >
                    <span className="mt-0.5 inline-flex size-8 items-center justify-center rounded-full bg-[#66cc8a]/20 text-sm font-semibold text-[var(--color-primary-800)]">
                      {index + 1}
                    </span>
                    <p className="text-slate-700">{step}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button href="/signup">Create your account</Button>
                <Button href="/login" intent="secondary">
                  Already using Tempora? Log in
                </Button>
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--color-primary-100)] bg-[rgba(236,249,240,0.65)] p-6 text-sm text-slate-700 shadow-2xl shadow-[rgba(102,204,138,0.12)]">
              <div className="flex items-center justify-between border-b border-[var(--color-primary-200)] pb-4">
                <p className="font-semibold text-slate-900">Live audit trail</p>
                <span className="rounded-full bg-[#66cc8a]/20 px-3 py-1 text-[var(--color-primary-800)]">
                  Protected
                </span>
              </div>
              <ul className="mt-4 space-y-3">
                <li className="flex items-start gap-3">
                  <span className="mt-1 size-2 rounded-full bg-[var(--color-primary-400)]" aria-hidden />
                  <div>
                    <p className="font-medium text-slate-900">Tempora Copilot rescheduled "Chemistry lab prep"</p>
                    <p className="text-slate-700">Moved to Thu 1:00 PM to avoid overlap with "Calculus lecture".</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 size-2 rounded-full bg-[var(--color-primary-400)]" aria-hidden />
                  <div>
                    <p className="font-medium text-slate-900">Focus hours protected</p>
                    <p className="text-slate-700">No new events during 8:00 AM - 10:00 AM before finals.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 size-2 rounded-full bg-amber-400" aria-hidden />
                  <div>
                    <p className="font-medium text-slate-900">Club event updated</p>
                    <p className="text-slate-700">Shared "Hackathon planning" slots with officer approvals.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
