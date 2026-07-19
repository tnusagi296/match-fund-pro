// Read-only investor-facing rendering of a Founder profile. Used by:
//   /founder/preview     — the founder's own "How Investors See Me" page
//   /demo/founder/preview — the demo walkthrough
//
// Deliberately avoids anything investor-side that isn't part of the public
// profile: no Investment Thesis fields, no Thesis Match number, no
// Investor Discover chrome, no private notes or ranking data.

import {
  Award,
  BadgeCheck,
  Briefcase,
  ExternalLink,
  Github,
  Globe,
  Linkedin,
  MapPin,
  Rocket,
  Sparkles,
  Star,
} from "lucide-react";
import {
  CONTACT_AVAILABILITIES,
  FOUNDER_STAGES,
  FUNDRAISING_STATUSES,
  type FounderProfile,
} from "@/lib/founder-profile";

function labelOf<T extends { value: string; label: string }>(
  options: T[],
  value: string | "",
): string | null {
  if (!value) return null;
  return options.find((o) => o.value === value)?.label ?? null;
}

function formatDate(iso?: string): string {
  if (!iso) return "just now";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "just now";
  }
}

export function FounderInvestorView({ profile }: { profile: FounderProfile }) {
  const stageLabel = labelOf(FOUNDER_STAGES, profile.stage);
  const fundraisingLabel = labelOf(FUNDRAISING_STATUSES, profile.fundraisingStatus);
  const contactLabel = labelOf(CONTACT_AVAILABILITIES, profile.contactAvailability);

  return (
    <article className="space-y-6">
      {/* Header card */}
      <section className="rounded-3xl glass p-8">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {profile.verified && (
                <span className="inline-flex items-center gap-1 rounded-full border border-mint/30 bg-mint-soft px-2 py-0.5 text-mint">
                  <BadgeCheck className="h-3 w-3" /> Verified founder
                </span>
              )}
              {profile.published ? (
                <span>Public profile · updated {formatDate(profile.lastUpdatedAt)}</span>
              ) : (
                <span>Draft · not yet visible to investors</span>
              )}
            </div>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight">
              {profile.name || "Unnamed founder"}
            </h1>
            {profile.headline && (
              <p className="mt-1.5 max-w-2xl text-base text-muted-foreground">
                {profile.headline}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              {profile.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {profile.location}
                </span>
              )}
              {profile.currentCompany && (
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" />
                  {profile.currentCompany}
                </span>
              )}
              {stageLabel && (
                <span className="inline-flex items-center gap-1.5">
                  <Rocket className="h-3.5 w-3.5" />
                  {stageLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Contact / fundraising badges */}
        <div className="mt-6 flex flex-wrap gap-2">
          {fundraisingLabel && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs">
              <Sparkles className="h-3 w-3 text-mint" /> {fundraisingLabel}
            </span>
          )}
          {contactLabel && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 border border-white/10 px-3 py-1 text-xs">
              {contactLabel}
            </span>
          )}
        </div>
      </section>

      {/* Biography */}
      {profile.biography && (
        <section className="rounded-2xl glass p-6">
          <SectionTitle>About</SectionTitle>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
            {profile.biography}
          </p>
        </section>
      )}

      {/* Sectors & skills */}
      {(profile.sectors.length > 0 || profile.skills.length > 0) && (
        <section className="rounded-2xl glass p-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {profile.sectors.length > 0 && (
              <div>
                <SectionTitle>Sectors</SectionTitle>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {profile.sectors.map((s) => (
                    <Chip key={s}>{s}</Chip>
                  ))}
                </div>
              </div>
            )}
            {profile.skills.length > 0 && (
              <div>
                <SectionTitle>Skills</SectionTitle>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {profile.skills.map((s) => (
                    <Chip key={s}>{s}</Chip>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Projects */}
      {profile.projects.length > 0 && (
        <section className="rounded-2xl glass p-6">
          <SectionTitle>Projects</SectionTitle>
          <ul className="mt-3 divide-y divide-white/5">
            {profile.projects.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {p.url ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 hover:text-mint"
                      >
                        {p.name} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      p.name
                    )}
                  </div>
                  {p.description && (
                    <div className="mt-0.5 text-xs text-muted-foreground">{p.description}</div>
                  )}
                </div>
                {typeof p.stars === "number" && (
                  <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="h-3 w-3" /> {p.stars.toLocaleString()}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Public traction / signals */}
      {(profile.strongestSignal || profile.signals.length > 0) && (
        <section className="rounded-2xl glass p-6">
          <SectionTitle>Public traction</SectionTitle>
          {profile.strongestSignal && (
            <p className="mt-3 text-sm text-foreground/90">{profile.strongestSignal}</p>
          )}
          {profile.signals.length > 0 && (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {profile.signals.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs"
                >
                  <Award className="mt-0.5 h-3.5 w-3.5 text-mint" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground/90">{s.label}</div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      {s.source ?? s.kind}
                    </div>
                  </div>
                  {s.url && (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Evidence sources */}
      <section className="rounded-2xl glass p-6">
        <SectionTitle>Evidence sources</SectionTitle>
        <ul className="mt-3 flex flex-wrap gap-2 text-xs">
          {profile.github && (
            <EvidenceLink
              icon={<Github className="h-3.5 w-3.5" />}
              label={`github.com/${profile.github}`}
              href={`https://github.com/${profile.github}`}
            />
          )}
          {profile.linkedin && (
            <EvidenceLink
              icon={<Linkedin className="h-3.5 w-3.5" />}
              label="LinkedIn"
              href={profile.linkedin}
            />
          )}
          {profile.site && (
            <EvidenceLink
              icon={<Globe className="h-3.5 w-3.5" />}
              label={profile.site.replace(/^https?:\/\//, "")}
              href={profile.site}
            />
          )}
          {!profile.github && !profile.linkedin && !profile.site && (
            <span className="text-muted-foreground">No public sources linked yet.</span>
          )}
        </ul>
      </section>
    </article>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </h2>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs">
      {children}
    </span>
  );
}

function EvidenceLink({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 hover:border-mint/30 hover:bg-mint-soft/40"
    >
      {icon}
      <span>{label}</span>
      <ExternalLink className="h-3 w-3 text-muted-foreground" />
    </a>
  );
}
