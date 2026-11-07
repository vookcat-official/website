"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

type Settings = {
  yt_live: string;
  link_yt: string;
  link_ezdo: string;
  link_tiktok: string;
  link_ig: string;
  link_fb: string;
  link_roblox_profile: string;
  link_roblox_group: string;
  link_discord: string;
};
type Role = "admin" | "user" | "member";
type Replay = { id: string; title: string; url: string; createdAt: string; access: "free" | "member" };
type User = { username: string; role: Role; createdAt: string };
type PendingDelete = { type: "user"; username: string } | { type: "replay"; replay: Replay };
type Home = {
  username: string;
  role: Role;
  canViewMemberContent: boolean;
  email: string;
  avatar: string;
  settings: Settings;
  replays: Replay[];
  memberReplays: Replay[];
  adminReplays: Replay[];
};
type Donation = { ok: boolean; msg?: string; warning?: string; data?: { leaderboard: Record<string, unknown>[]; timer: Record<string, unknown> } };
type YouTubePlayer = {
  destroy: () => void;
  mute: () => void;
  playVideo: () => void;
  getDuration: () => number;
  getVideoData: () => { isLiveContent?: boolean };
};
type YouTubeApi = {
  PlayerState: { ENDED: number; PLAYING: number };
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      playerVars: Record<string, number>;
      events: {
        onReady: (event: { target: YouTubePlayer }) => void;
        onStateChange: (event: { target: YouTubePlayer; data: number }) => void;
        onError: () => void;
      };
    },
  ) => YouTubePlayer;
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiLoad: Promise<void> | undefined;

const links: { key: keyof Settings; name: string; icon: string; color: string }[] = [
  { key: "link_yt", name: "YouTube", icon: "youtube", color: "#ff0033" },
  { key: "link_ezdo", name: "EasyDonate", icon: "donate", color: "#f5a524" },
  { key: "link_tiktok", name: "TikTok", icon: "tiktok", color: "#111111" },
  { key: "link_ig", name: "Instagram", icon: "instagram", color: "#d6249f" },
  { key: "link_fb", name: "Facebook", icon: "facebook", color: "#1877f2" },
  { key: "link_roblox_profile", name: "Roblox โปรไฟล์", icon: "roblox", color: "#e2231a" },
  { key: "link_roblox_group", name: "Roblox กรุ๊ป", icon: "roblox", color: "#c4161c" },
  { key: "link_discord", name: "Discord กรุ๊ป", icon: "discord", color: "#5865f2" },
];

function BrandIcon({ name }: { name: string }) {
  const shared = { "aria-hidden": true as const, focusable: "false" as const, viewBox: "0 0 24 24" };
  switch (name) {
    case "youtube":
      return <svg {...shared}><path fill="currentColor" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8Z" /><path fill="#ff0033" d="M9.6 15.8V8.2l6.5 3.8-6.5 3.8Z" /></svg>;
    case "donate":
      return <svg {...shared}><path fill="currentColor" d="M12 21s-8-4.8-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.2-8 11-8 11Z" /><path fill="#f5a524" d="M12 8.5a.8.8 0 0 1 .8.8v.3h.7a.7.7 0 1 1 0 1.4h-1.6a.4.4 0 0 0 0 .8h.2a1.8 1.8 0 0 1 .7 3.4v.3a.8.8 0 0 1-1.6 0v-.3h-.7a.7.7 0 1 1 0-1.4h1.6a.4.4 0 0 0 0-.8h-.2a1.8 1.8 0 0 1-.7-3.4v-.3a.8.8 0 0 1 .8-.8Z" /></svg>;
    case "tiktok":
      return <svg {...shared}><path fill="#25f4ee" d="M15 3h3a5.5 5.5 0 0 0 3 4v3a8.5 8.5 0 0 1-6-2v7a6 6 0 1 1-6-6h1v3h-1a3 3 0 1 0 3 3V3h3v.2Z" /><path fill="#fe2c55" d="M14 4h3a5.5 5.5 0 0 0 3 4v3a8.5 8.5 0 0 1-6-2v7a6 6 0 1 1-6-6h1v3h-1a3 3 0 1 0 3 3V4h3v.2Z" transform="translate(-1 -1)" /><path fill="currentColor" d="M15 3h3a5.5 5.5 0 0 0 3 4v3a8.5 8.5 0 0 1-6-2v7a6 6 0 1 1-6-6h1v3h-1a3 3 0 1 0 3 3V3h3v.2Z" /></svg>;
    case "instagram":
      return <svg {...shared} fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>;
    case "facebook":
      return <svg {...shared}><path fill="currentColor" d="M13.5 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5h1.7V3.9c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3V10H7.3v3h2.8v8h3.4Z" /></svg>;
    case "roblox":
      return <svg {...shared}><path fill="currentColor" fillRule="evenodd" d="m6.2 2 15.8 4-4.2 16L2 18 6.2 2Zm2.1 5.2-2 7.5 7.5 1.9 2-7.5-7.5-1.9Z" /></svg>;
    case "discord":
      return <svg {...shared}><path fill="currentColor" d="M19.7 5.4A18 18 0 0 0 15.3 4l-.5 1a16 16 0 0 0-5.6 0l-.5-1a18 18 0 0 0-4.4 1.4C1.5 9.5.7 13.5 1.1 17.4a18 18 0 0 0 5.4 2.7l1.2-2a11 11 0 0 1-1.9-.9l.5-.4a13 13 0 0 0 11.4 0l.5.4-1.9.9 1.2 2a18 18 0 0 0 5.4-2.7c.5-4.5-.8-8.5-3.2-12Zm-10.2 9a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4Zm5 0a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4Z" /></svg>;
    default:
      return null;
  }
}

async function apiGet<T>(action: string): Promise<T> {
  const response = await fetch(`/api?action=${encodeURIComponent(action)}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  const result = (await response.json()) as T & { message?: string };
  if (!response.ok) throw new Error(result.message || "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
  return result;
}

async function apiPost<T>(action: string, values: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch("/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ action, ...values }),
  });
  const result = (await response.json()) as T & { message?: string };
  if (!response.ok) throw new Error(result.message || "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
  return result;
}

function roleLabel(role: Role) {
  if (role === "admin") return "แอดมิน";
  if (role === "member") return "สมาชิก";
  return "ผู้ใช้";
}

function createProfileAvatar(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
    return Promise.reject(new Error("เลือกรูป JPG, PNG, WEBP หรือ GIF"));
  }
  if (file.size > 5 * 1024 * 1024) {
    return Promise.reject(new Error("รูปต้นฉบับต้องมีขนาดไม่เกิน 5 MB"));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
    reader.onload = () => {
      const image = new window.Image();
      image.onerror = () => reject(new Error("เปิดไฟล์รูปไม่สำเร็จ"));
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = 160;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("เตรียมรูปโปรไฟล์ไม่สำเร็จ"));
          return;
        }
        const side = Math.min(image.naturalWidth, image.naturalHeight);
        const x = (image.naturalWidth - side) / 2;
        const y = (image.naturalHeight - side) / 2;
        context.drawImage(image, x, y, side, side, 0, 0, 160, 160);
        for (const quality of [0.8, 0.65, 0.5]) {
          const result = canvas.toDataURL("image/jpeg", quality);
          if (result.length <= 32_000) {
            resolve(result);
            return;
          }
        }
        reject(new Error("ย่อรูปไม่สำเร็จ กรุณาเลือกรูปอื่น"));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function youtubeId(value: string) {
  const match = value.match(/(?:v=|youtu\.be\/|\/live\/|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
  return match?.[1] ?? "";
}

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (!youtubeApiLoad) {
    youtubeApiLoad = new Promise((resolve, reject) => {
      const previousCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousCallback?.();
        resolve();
      };
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.onerror = () => reject(new Error("โหลด YouTube Player API ไม่สำเร็จ"));
        document.head.appendChild(script);
      }
    });
  }
  return youtubeApiLoad;
}

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const time = now?.toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour12: false }) ?? "--:--:--";
  const dateParts = now
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Bangkok",
        weekday: "short",
        day: "numeric",
        month: "numeric",
        year: "numeric",
      }).formatToParts(now)
    : [];
  const dateValues = Object.fromEntries(dateParts.map(({ type, value }) => [type, value]));
  const weekdays: Record<string, string> = {
    Sun: "อา.",
    Mon: "จ.",
    Tue: "อ.",
    Wed: "พ.",
    Thu: "พฤ.",
    Fri: "ศ.",
    Sat: "ส.",
  };
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const date = now
    ? `${weekdays[dateValues.weekday]} ${dateValues.day}/${months[Number(dateValues.month) - 1]}/${String(Number(dateValues.year) + 543).slice(-2)}`
    : "";
  return <div className="clock"><b>{time}</b><span>{date}</span></div>;
}

function LivePlayer({ title, url, emptyText }: { title: string; url: string; emptyText: string }) {
  const id = youtubeId(url);
  const container = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id || !container.current) return;
    let active = true;
    let player: YouTubePlayer | undefined;
    let liveCheck: number | undefined;
    let liveDuration: number | undefined;
    let liveDetected = false;
    const stopLiveCheck = () => {
      if (liveCheck !== undefined) window.clearInterval(liveCheck);
      liveCheck = undefined;
      liveDuration = undefined;
    };
    void loadYouTubeApi().then(() => {
      if (!active || !container.current || !window.YT?.Player) return;
      player = new window.YT.Player(container.current, {
        videoId: id,
        playerVars: { autoplay: 1, mute: 1, playsinline: 1, rel: 0, enablejsapi: 1 },
        events: {
          onReady: (event) => {
            event.target.mute();
            event.target.playVideo();
          },
          onStateChange: (event) => {
            if (event.data === window.YT?.PlayerState.PLAYING) {
              if (!event.target.getVideoData().isLiveContent) {
                stopLiveCheck();
                liveDetected = false;
                setLive(false);
              } else if (!liveDetected && liveCheck === undefined) {
                liveDuration = event.target.getDuration();
                let checks = 0;
                liveCheck = window.setInterval(() => {
                  const duration = event.target.getDuration();
                  checks += 1;
                  if (Number.isFinite(duration) && liveDuration !== undefined && duration > liveDuration) {
                    liveDetected = true;
                    setLive(true);
                    stopLiveCheck();
                  } else if (checks >= 5) {
                    stopLiveCheck();
                  } else {
                    liveDuration = duration;
                  }
                }, 3000);
              }
              setMessage("");
            }
            if (event.data === window.YT?.PlayerState.ENDED) {
              stopLiveCheck();
              liveDetected = false;
              setLive(false);
              setMessage(event.target.getVideoData().isLiveContent ? "ไลฟ์จบแล้ว" : "วิดีโอจบแล้ว");
            }
          },
          onError: () => {
            stopLiveCheck();
            liveDetected = false;
            setLive(false);
            setError(true);
          },
        },
      });
    }).catch(() => {
      if (active) setError(true);
    });
    return () => {
      active = false;
      stopLiveCheck();
      player?.destroy();
    };
  }, [id]);

  return (
    <>
      <h2>{title} {id && live && <span className="live-pill">ไลฟ์</span>}</h2>
      <div className="player">
        {id ? (
          message || error
            ? <div className="empty">{error ? "ไม่สามารถเล่นไลฟ์นี้ได้" : message}</div>
            : <div className="youtube-player" ref={container} title="YouTube Live" />
        ) : <div className="empty">{emptyText}</div>}
      </div>
    </>
  );
}

function secondsFromTimer(timer: unknown): number | null {
  if (typeof timer === "number") return Math.max(0, Math.floor(timer));
  if (typeof timer === "string") {
    const text = timer.trim();
    if (/^\d+(?:\.\d+)?$/.test(text)) return Math.max(0, Math.floor(Number(text)));
    const parts = text.split(":").map(Number);
    if (parts.length === 3 && parts.every(Number.isFinite)) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2 && parts.every(Number.isFinite)) return parts[0] * 60 + parts[1];
    return null;
  }
  if (!timer || typeof timer !== "object") return null;
  const object = timer as Record<string, unknown>;
  const nested = object.timer && typeof object.timer === "object"
    ? object.timer as Record<string, unknown>
    : object;
  for (const key of ["remainingSeconds", "secondsRemaining", "timeRemaining", "remaining", "seconds", "duration", "time", "value"]) {
    const value = nested[key];
    if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
    if (typeof value === "string") {
      const parsed = secondsFromTimer(value);
      if (parsed !== null) return parsed;
    }
  }
  return null;
}

function getTimerState(timer: Record<string, unknown> | undefined) {
  const metadata = timer?.metadata;
  const metadataTimer = metadata && typeof metadata === "object"
    ? (metadata as Record<string, unknown>).timer
    : undefined;
  const current = metadata && typeof metadata === "object"
    ? (metadata as Record<string, unknown>).current ??
      (metadataTimer && typeof metadataTimer === "object"
        ? (metadataTimer as Record<string, unknown>).current
        : undefined)
    : undefined;
  const currentState = current && typeof current === "object"
    ? current as Record<string, unknown>
    : undefined;
  const milliseconds = currentState?.value;
  const seconds = typeof milliseconds === "number" && Number.isFinite(milliseconds)
    ? Math.max(0, Math.floor(milliseconds / 1000))
    : secondsFromTimer(timer);
  const directRunning = timer && (
    timer.isRunning === true ||
    timer.running === true ||
    timer.isActive === true ||
    ["running", "active", "playing"].includes(String(timer.status ?? "").toLowerCase())
  );
  return {
    seconds,
    running: typeof currentState?.isRunning === "boolean"
      ? currentState.isRunning
      : Boolean(directRunning),
  };
}

function formatTimer(seconds: number | null) {
  if (seconds === null) return "--:--";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  const parts = hours > 0 ? [hours, minutes, remaining] : [minutes, remaining];
  return parts.map((value) => String(value).padStart(2, "0")).join(":");
}

function DonationTimer({ seconds, running }: { seconds: number | null; running: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running || seconds === null) return;
    const startedAt = Date.now();
    let interval = 0;
    const update = () => {
      const next = Math.floor((Date.now() - startedAt) / 1000);
      setElapsed(next);
      if (next >= seconds) window.clearInterval(interval);
    };
    interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [running, seconds]);
  const remaining = seconds === null
    ? null
    : running
      ? Math.max(0, seconds - elapsed)
      : seconds;
  return (
    <div className="don-timer">
      <div className="don-timer-label">Donate Timer</div>
      <div className="don-timer-value">{formatTimer(remaining)}</div>
    </div>
  );
}

function DonationPanel({ donation, loading }: { donation: Donation | null; loading: boolean }) {
  const timer = donation?.data?.timer;
  const { seconds: initialSeconds, running } = getTimerState(timer);
  const leaderboard = donation?.data?.leaderboard ?? [];
  return (
    <>
      <DonationTimer key={`${initialSeconds}-${running}`} seconds={initialSeconds} running={running} />
      <div className="don-section-title">Leaderboard ผู้โดเนท</div>
      {loading ? <div className="empty">กำลังโหลด...</div> : donation?.ok === false ? (
        <div className="empty">{donation.msg || "โหลดข้อมูล EZdonate ไม่สำเร็จ"}</div>
      ) : leaderboard.length === 0 ? <div className="empty">ยังไม่มีข้อมูล Leaderboard</div> : (
        <ul className="don">
          {leaderboard.slice(0, 20).map((item, index) => {
            const name = item.name ?? item.donator ?? item.donatorName ?? item.username ??
              item.donor_name ?? item.donorName ?? item.donor ?? item.display_name ?? "ไม่ระบุชื่อ";
            const amount = Number(
              item.amount ?? item.price ?? item.donation_amount ?? item.donationAmount ??
              item.total_amount ?? item.totalAmount ?? 0,
            ) || 0;
            return (
              <li key={`${String(name)}-${index}`}>
                <span>{index + 1}. {String(name)}</span>
                <b>฿{amount.toLocaleString("th-TH", { maximumFractionDigits: 2 })}</b>
              </li>
            );
          })}
        </ul>
      )}
      {donation?.warning && <div className="don-warning">{donation.warning}</div>}
    </>
  );
}

function LinkGrid({ settings }: { settings: Settings }) {
  return (
    <div className="links">
      {links.map(({ key, name, icon, color }) => {
        const url = settings[key];
        if (!/^https?:\/\//i.test(url)) return null;
        return (
          <a className="lk" href={url} target="_blank" rel="noopener noreferrer" key={key}>
            <div className="ic" style={{ background: color }}><BrandIcon name={icon} /></div>
            <span>{name}</span>
          </a>
        );
      })}
    </div>
  );
}

function ReplayCards({ replays }: { replays: Replay[] }) {
  if (!replays.length) return <div className="replay-empty">ยังไม่มีคลิปไลฟ์ย้อนหลัง</div>;
  return (
    <div className="replays">
      {replays.map((replay, index) => {
        const id = youtubeId(replay.url);
        const validUrl = /^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(replay.url);
        const title = replay.title || "คลิปไลฟ์ย้อนหลัง";
        const card = (
          <>
            <div className="cover">
              {id ? <>
                <Image
                  src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
                  width={480}
                  height={270}
                  loading="lazy"
                  alt=""
                  unoptimized
                />
                <span className="yt-badge">YouTube</span>
                <span className="play"><span>▶</span></span>
              </> : <div className="empty">ลิงก์คลิปไม่ถูกต้อง</div>}
            </div>
            <div className="replay-info">
              <h3>{title}</h3>
              {replay.createdAt && <small>{replay.createdAt}</small>}
            </div>
          </>
        );
        return id && validUrl ? (
          <a
            className="replay-card"
            href={replay.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`เปิดคลิป ${title} บน YouTube`}
            style={{ animationDelay: `${index * 70}ms` }}
            key={replay.id}
          >{card}</a>
        ) : (
          <div className="replay-card" key={replay.id}>{card}</div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const [publicSettings, setPublicSettings] = useState<Settings | null>(null);
  const [home, setHome] = useState<Home | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [tab, setTab] = useState<"home" | "member" | "users" | "settings">("home");
  const [loginName, setLoginName] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [publicDonation, setPublicDonation] = useState<Donation | null>(null);
  const [memberDonation, setMemberDonation] = useState<Donation | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [usersMessage, setUsersMessage] = useState("");
  const [roleDrafts, setRoleDrafts] = useState<Record<string, Role>>({});
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<Role>("user");
  const [resetTarget, setResetTarget] = useState("");
  const [resetPasswordDraft, setResetPasswordDraft] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<Settings | null>(null);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [replayTitle, setReplayTitle] = useState("");
  const [replayUrl, setReplayUrl] = useState("");
  const [replayAccess, setReplayAccess] = useState<"free" | "member">("free");
  const [replayMessage, setReplayMessage] = useState("");
  const [replayError, setReplayError] = useState("");
  const [toast, setToast] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileEmail, setProfileEmail] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);

  const loadDonation = useCallback(async (isPublic: boolean) => {
    try {
      const result = await apiGet<Donation>("donate");
      if (isPublic) setPublicDonation(result);
      else setMemberDonation(result);
    } catch {
      const failed: Donation = { ok: false, msg: "โหลดข้อมูล EZdonate ไม่สำเร็จ" };
      if (isPublic) setPublicDonation(failed);
      else setMemberDonation(failed);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const result = await apiGet<User[]>("users");
      setUsers(result);
      setRoleDrafts(Object.fromEntries(result.map((user) => [user.username, user.role])));
      setUsersMessage("");
    } catch (error) {
      setUsersMessage(error instanceof Error ? error.message : "โหลดรายชื่อผู้ใช้ไม่สำเร็จ");
    }
  }, []);

  const loadHome = useCallback(async () => {
    const result = await apiGet<Home>("home");
    setHome(result);
    setSettingsDraft(result.settings);
    setShowLogin(false);
    setTab("home");
    void loadDonation(false);
    if (result.role === "admin") void loadUsers();
  }, [loadDonation, loadUsers]);

  useEffect(() => {
    let active = true;
    apiGet<{ settings: Settings }>("public")
      .then((result) => {
        if (active) setPublicSettings(result.settings);
        return loadDonation(true);
      })
      .catch(() => { if (active) setPublicSettings(null); });
    apiGet<Home>("home")
      .then((result) => {
        if (!active) return;
        setHome(result);
        setSettingsDraft(result.settings);
        void loadDonation(false);
        if (result.role === "admin") void loadUsers();
      })
      .catch(() => { if (active) setHome(null); });
    return () => { active = false; };
  }, [loadDonation, loadUsers]);

  useEffect(() => {
    const refreshDonation = () => {
      if (document.visibilityState !== "visible") return;
      void loadDonation(home === null);
    };
    const interval = window.setInterval(refreshDonation, 10_000);
    document.addEventListener("visibilitychange", refreshDonation);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshDonation);
    };
  }, [home, loadDonation]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginBusy(true);
    setLoginMessage("");
    try {
      const result = await apiPost<{ ok: boolean; msg?: string }>("login", {
        username: loginName,
        password: loginPassword,
      });
      if (!result.ok) {
        setLoginMessage(result.msg || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
        return;
      }
      setLoginPassword("");
      await loadHome();
    } catch (error) {
      setLoginMessage(error instanceof Error ? error.message : "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setLoginBusy(false);
    }
  };

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginMessage("");
    if (loginPassword !== confirmPassword) {
      setLoginMessage("รหัสผ่านยืนยันไม่ตรงกัน");
      return;
    }
    setLoginBusy(true);
    try {
      const result = await apiPost<{ ok: boolean; msg?: string }>("register", {
        username: loginName,
        password: loginPassword,
      });
      if (!result.ok) {
        setLoginMessage(result.msg || "สมัครสมาชิกไม่สำเร็จ");
        return;
      }
      setAuthMode("login");
      setLoginPassword("");
      setConfirmPassword("");
      setLoginMessage("สมัครบัญชีเรียบร้อยแล้ว กรุณาเข้าสู่ระบบ");
    } catch (error) {
      setLoginMessage(error instanceof Error ? error.message : "สมัครสมาชิกไม่สำเร็จ");
    } finally {
      setLoginBusy(false);
    }
  };

  const logout = async () => {
    try {
      await apiPost("logout");
      setHome(null);
      setTab("home");
      setShowLogin(false);
      setToast("");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "ออกจากระบบไม่สำเร็จ");
    }
  };

  const addUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUsersMessage("");
    try {
      const result = await apiPost<{ ok: boolean; msg?: string }>("addUser", {
        username: newUsername,
        password: newPassword,
        role: newRole,
      });
      if (!result.ok) {
        setUsersMessage(result.msg || "เพิ่มผู้ใช้ไม่สำเร็จ");
        return;
      }
      setNewUsername("");
      setNewPassword("");
      setUsersMessage("เพิ่มผู้ใช้เรียบร้อย");
      await loadUsers();
    } catch (error) {
      setUsersMessage(error instanceof Error ? error.message : "เพิ่มผู้ใช้ไม่สำเร็จ");
    }
  };

  const changeUserRole = async (username: string) => {
    const role = roleDrafts[username];
    if (!role) return;
    setUsersMessage("");
    try {
      const result = await apiPost<{ ok: boolean; msg?: string }>("updateUserRole", { username, role });
      if (!result.ok) {
        setUsersMessage(result.msg || "เปลี่ยน Role ไม่สำเร็จ");
        return;
      }
      setUsersMessage(`เปลี่ยน Role ของ ${username} แล้ว`);
      await loadUsers();
    } catch (error) {
      setUsersMessage(error instanceof Error ? error.message : "เปลี่ยน Role ไม่สำเร็จ");
    }
  };

  const deleteAccount = async (username: string) => {
    try {
      const result = await apiPost<{ ok: boolean; msg?: string }>("deleteUser", { username });
      if (!result.ok) {
        setToast(result.msg || "ลบผู้ใช้ไม่สำเร็จ");
        return;
      }
      setToast("ลบแล้ว");
      await loadUsers();
    } catch (error) {
      setToast(error instanceof Error ? error.message : "ลบผู้ใช้ไม่สำเร็จ");
    }
  };

  const openPasswordReset = (username: string) => {
    setResetTarget(username);
    setResetPasswordDraft("");
    setResetMessage("");
  };

  const resetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResetMessage("");
    setResetBusy(true);
    try {
      const result = await apiPost<{ ok: boolean; msg?: string }>("resetPassword", {
        username: resetTarget,
        password: resetPasswordDraft,
      });
      if (!result.ok) {
        setResetMessage(result.msg || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
        return;
      }
      setResetTarget("");
      setToast(`เปลี่ยนรหัสผ่านของ ${resetTarget} แล้ว`);
    } catch (error) {
      setResetMessage(error instanceof Error ? error.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    } finally {
      setResetBusy(false);
    }
  };

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settingsDraft) return;
    setSettingsMessage("");
    try {
      const result = await apiPost<{ ok: boolean; msg?: string }>("saveSettings", { settings: settingsDraft });
      if (!result.ok) {
        setSettingsMessage(result.msg || "บันทึกการตั้งค่าไม่สำเร็จ");
        return;
      }
      setSettingsMessage("บันทึกแล้ว");
      setToast("บันทึกการตั้งค่าแล้ว");
      await loadHome();
    } catch (error) {
      setSettingsMessage(error instanceof Error ? error.message : "บันทึกการตั้งค่าไม่สำเร็จ");
    }
  };

  const openProfile = () => {
    if (!home) return;
    setProfileEmail(home.email);
    setProfileAvatar(home.avatar);
    setProfileMessage("");
    setProfileOpen(true);
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileMessage("");
    setProfileBusy(true);
    try {
      const result = await apiPost<{ ok: boolean; msg?: string }>("saveProfile", {
        profile: { email: profileEmail, avatar: profileAvatar },
      });
      if (!result.ok) {
        setProfileMessage(result.msg || "บันทึกโปรไฟล์ไม่สำเร็จ");
        return;
      }
      setHome((current) => current
        ? { ...current, email: profileEmail.trim(), avatar: profileAvatar }
        : current);
      setProfileOpen(false);
      setToast("บันทึกโปรไฟล์แล้ว");
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "บันทึกโปรไฟล์ไม่สำเร็จ");
    } finally {
      setProfileBusy(false);
    }
  };

  const addReplay = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReplayMessage("");
    setReplayError("");
    try {
      const result = await apiPost<{ ok: boolean; msg?: string }>("addReplay", {
        title: replayTitle,
        url: replayUrl,
        access: replayAccess,
      });
      if (!result.ok) {
        setReplayMessage(result.msg || "เพิ่มคลิปไม่สำเร็จ");
        return;
      }
      setReplayTitle("");
      setReplayUrl("");
      setReplayMessage(result.msg || "เพิ่มคลิปแล้ว");
      await loadHome();
    } catch (error) {
      setReplayMessage(error instanceof Error ? error.message : "เพิ่มคลิปไม่สำเร็จ");
    }
  };

  const deleteReplay = async (replay: Replay) => {
    try {
      const result = await apiPost<{ ok: boolean; msg?: string }>("deleteReplay", { id: replay.id });
      if (!result.ok) {
        setReplayError(result.msg || "ลบคลิปไม่สำเร็จ");
        return;
      }
      setReplayError("");
      setToast("ลบคลิปแล้ว");
      await loadHome();
    } catch (error) {
      setReplayError(error instanceof Error ? error.message : "ลบคลิปไม่สำเร็จ");
    }
  };

  const confirmDelete = async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (target?.type === "user") await deleteAccount(target.username);
    if (target?.type === "replay") await deleteReplay(target.replay);
  };

  const changeSettings = (key: keyof Settings, value: string) => {
    setSettingsDraft((current) => current ? { ...current, [key]: value } : current);
  };

  const canViewMemberContent = home?.canViewMemberContent ?? false;

  if (!home && showLogin) {
    return (
      <section className="login">
        <form className="login-card" onSubmit={authMode === "login" ? handleLogin : handleSignup}>
          <div className="logo"><Image src="/vookcat-avatar.png" alt="" width={56} height={56} priority /></div>
          <h1>{authMode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}</h1>
          <p>{authMode === "login" ? "กรอกชื่อผู้ใช้และรหัสผ่านเพื่อเข้าใช้งาน" : "สมัครบัญชีผู้ใช้เพื่อเริ่มต้นใช้งาน"}</p>
          <label htmlFor="login-name">ชื่อผู้ใช้ (Username)</label>
          <input
            id="login-name"
            maxLength={30}
            minLength={3}
            pattern="[A-Za-z0-9_.-]+"
            autoComplete="username"
            autoCapitalize="none"
            value={loginName}
            onChange={(event) => setLoginName(event.target.value)}
            required
          />
          <label htmlFor="login-password">รหัสผ่าน (Password)</label>
          <input
            id="login-password"
            type="password"
            autoComplete={authMode === "login" ? "current-password" : "new-password"}
            minLength={6}
            maxLength={128}
            value={loginPassword}
            onChange={(event) => setLoginPassword(event.target.value)}
            required
          />
          {authMode === "signup" && <>
            <label htmlFor="confirm-password">ยืนยันรหัสผ่าน</label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              maxLength={128}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </>}
          <button className="btn full" type="submit" disabled={loginBusy}>
            {loginBusy ? "กำลังดำเนินการ..." : authMode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
          </button>
          <div className={`msg${loginMessage.startsWith("สมัครบัญชี") ? " ok" : ""}`} role="alert">{loginMessage}</div>
          <button className="btn ghost full auth-switch" type="button" onClick={() => {
            setAuthMode(authMode === "login" ? "signup" : "login");
            setLoginPassword("");
            setLoginMessage("");
            setConfirmPassword("");
          }}>
            {authMode === "login" ? "ยังไม่มีบัญชี? สมัครสมาชิก" : "มีบัญชีแล้ว? เข้าสู่ระบบ"}
          </button>
          <button className="btn ghost full back-button" type="button" onClick={() => { setShowLogin(false); setAuthMode("login"); setLoginMessage(""); }}>
            กลับหน้าแรก
          </button>
        </form>
      </section>
    );
  }

  if (!home) {
    return (
      <>
        <header className="top"><div className="top-in">
          <div className="brand"><div className="logo"><Image src="/vookcat-avatar.png" alt="" width={38} height={38} priority /></div>vookcat web</div>
          <Clock />
          <button className="btn" type="button" onClick={() => { setAuthMode("login"); setLoginMessage(""); setShowLogin(true); }}>เข้าสู่ระบบ</button>
        </div></header>
        <main>
          <div className="grid">
            <section className="card">
              <LivePlayer title="คลิป/ไลฟ์ YouTube" key={publicSettings?.yt_live ?? ""} url={publicSettings?.yt_live ?? ""} emptyText="ยังไม่มีไลฟ์ในตอนนี้" />
            </section>
            <section className="card">
              <h2><span>EasyDonate</span><button className="btn ghost header-reload" type="button" onClick={() => void loadDonation(true)}>รีเฟรช</button></h2>
              <DonationPanel donation={publicDonation} loading={publicDonation === null} />
            </section>
          </div>
          {publicSettings && <LinkGrid settings={publicSettings} />}
          {!publicSettings && <p className="page-error">โหลดข้อมูลหน้าแรกไม่สำเร็จ</p>}
        </main>
      </>
    );
  }

  return (
    <>
      <header className="top"><div className="top-in">
        <div className="brand"><div className="logo"><Image src="/vookcat-avatar.png" alt="" width={38} height={38} priority /></div>vookcat web</div>
        <Clock />
        <div className={`profile-trigger${home.role === "admin" ? " admin" : ""}`}>
          <button className="profile-edit" type="button" onClick={openProfile} aria-label="แก้ไขโปรไฟล์">
            <span className={`profile-avatar${home.role === "admin" ? " admin" : ""}`}>
              <Image src={home.avatar || "/vookcat-avatar.png"} alt="" width={48} height={48} unoptimized />
            </span>
            <span className="profile-info">
              <strong>{home.username}</strong>
              <span className={`profile-role${home.role === "admin" ? " admin" : home.role === "member" ? " member" : ""}`}>
                {roleLabel(home.role)}
              </span>
            </span>
          </button>
          <button className="profile-logout" type="button" onClick={() => void logout()}>ออกจากระบบ</button>
        </div>
      </div></header>
      <nav className="tabs">
        <button className={`tab${tab === "home" ? " on" : ""}`} onClick={() => setTab("home")}>หน้าแรก</button>
        {canViewMemberContent && <button className={`tab${tab === "member" ? " on" : ""}`} onClick={() => setTab("member")}>สมาชิก</button>}
        {home.role === "admin" && <>
          <button className={`tab${tab === "users" ? " on" : ""}`} onClick={() => setTab("users")}>จัดการผู้ใช้</button>
          <button className={`tab${tab === "settings" ? " on" : ""}`} onClick={() => setTab("settings")}>ตั้งค่าไลฟ์และลิงก์</button>
        </>}
      </nav>
      <main>
        {tab === "home" && <>
          <div className="grid">
            <section className="card">
              <LivePlayer title="คลิป/ไลฟ์ YouTube" key={home.settings.yt_live} url={home.settings.yt_live} emptyText={'ยังไม่มีไลฟ์ในตอนนี้\nแอดมินสามารถใส่ลิงก์ได้ที่แท็บ "ตั้งค่าไลฟ์และลิงก์"'} />
            </section>
            <section className="card">
              <h2><span>EasyDonate</span><button className="btn ghost header-reload" type="button" onClick={() => void loadDonation(false)}>รีเฟรช</button></h2>
              <DonationPanel donation={memberDonation} loading={memberDonation === null} />
            </section>
          </div>
          <LinkGrid settings={home.settings} />
          <section className="zone">
            <div className="zone-head">
              <h2>🎬 คลิปทั้งหมดไม่นับสมาชิก</h2>
              <span className="zone-count">{home.replays.length} คลิป</span>
              <p>คลิปฟรีสำหรับผู้ใช้ทุกคน กดที่ปกเพื่อไปดูบน YouTube</p>
            </div>
            <ReplayCards replays={home.replays} />
          </section>
        </>}

        {tab === "member" && canViewMemberContent && <section className="zone">
          <div className="zone-head">
            <h2>🎬 คลิปไลฟ์ย้อนหลังสำหรับสมาชิก</h2>
            <span className="zone-count">{home.memberReplays.length} คลิป</span>
            <p>คลิปเฉพาะสมาชิก กดที่ปกเพื่อไปดูบน YouTube</p>
          </div>
          <ReplayCards replays={home.memberReplays} />
        </section>}

        {tab === "users" && home.role === "admin" && <>
          <section className="card">
            <h2>เพิ่มผู้ใช้ใหม่</h2>
            <form className="row" onSubmit={addUser}>
              <div><label htmlFor="new-username">ชื่อผู้ใช้</label><input id="new-username" autoCapitalize="none" autoComplete="off" value={newUsername} onChange={(event) => setNewUsername(event.target.value)} required /></div>
              <div><label htmlFor="new-password">รหัสผ่าน (6-128 ตัว)</label><input id="new-password" type="password" autoComplete="new-password" minLength={6} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></div>
              <div><label htmlFor="new-role">Role</label><select id="new-role" value={newRole} onChange={(event) => setNewRole(event.target.value as Role)}><option value="user">ผู้ใช้</option><option value="member">สมาชิก</option><option value="admin">แอดมิน</option></select></div>
              <button className="btn" type="submit">เพิ่มผู้ใช้</button>
            </form>
            <div className="msg" role="alert">{usersMessage}</div>
          </section>
          <section className="card table-card">
            <h2>รายชื่อผู้ใช้</h2>
            <table className="tbl"><thead><tr><th>ชื่อผู้ใช้</th><th>สิทธิ์</th><th>สร้างเมื่อ</th><th></th></tr></thead>
              <tbody>
                {users.map((user) => <tr key={user.username}>
                  <td>{user.username}</td>
                  <td><span className={`role${user.role === "admin" ? " admin" : user.role === "member" ? " member" : ""}`}>{roleLabel(user.role)}</span></td>
                  <td>{user.createdAt}</td>
                  <td className="table-actions">
                    <select
                      className="role-select"
                      aria-label={`Role ของ ${user.username}`}
                      value={roleDrafts[user.username] ?? user.role}
                      disabled={user.username.toLowerCase() === home.username.toLowerCase()}
                      onChange={(event) => setRoleDrafts((current) => ({
                        ...current,
                        [user.username]: event.target.value as Role,
                      }))}
                    >
                      <option value="user">ผู้ใช้</option>
                      <option value="member">สมาชิก</option>
                      <option value="admin">แอดมิน</option>
                    </select>
                    <button
                      className="btn ghost small-action"
                      type="button"
                      disabled={user.username.toLowerCase() === home.username.toLowerCase() || (roleDrafts[user.username] ?? user.role) === user.role}
                      onClick={() => void changeUserRole(user.username)}
                    >บันทึก Role</button>
                    <button className="btn ghost small-action" type="button" onClick={() => openPasswordReset(user.username)}>รีเซ็ตรหัส</button>
                    <button className="btn danger" type="button" onClick={() => setPendingDelete({ type: "user", username: user.username })}>ลบ</button>
                  </td>
                </tr>)}
                {!users.length && <tr><td colSpan={4}>ยังไม่มีผู้ใช้</td></tr>}
              </tbody>
            </table>
          </section>
        </>}

        {tab === "settings" && home.role === "admin" && settingsDraft && <>
          <form onSubmit={saveSettings}>
            <section className="card">
              <h2>ลิงค์คลิป/ไลฟ์ YouTube</h2>
              <label htmlFor="yt-live">วางลิงก์ไลฟ์ (เว้นว่างเพื่อปิดการแสดงผล)</label>
              <input id="yt-live" placeholder="https://www.youtube.com/watch?v=... หรือ https://www.youtube.com/live/..." value={settingsDraft.yt_live} onChange={(event) => changeSettings("yt_live", event.target.value)} />
            </section>
            <section className="card spaced-card">
              <h2>ลิงก์ปุ่มต่าง ๆ</h2>
              <div className="form2">
                {links.map(({ key, name }) => <div key={key}>
                  <label htmlFor={`setting-${key}`}>{name}</label>
                  <input id={`setting-${key}`} placeholder="https://..." value={settingsDraft[key]} onChange={(event) => changeSettings(key, event.target.value)} />
                </div>)}
              </div>
              <button className="btn spaced-button" type="submit">บันทึกการตั้งค่า</button>
              <div className={`msg${settingsMessage === "บันทึกแล้ว" ? " ok" : ""}`} role="alert">{settingsMessage}</div>
            </section>
          </form>
          <section className="card spaced-card">
            <h2>เพิ่มคลิปไลฟ์ย้อนหลัง</h2>
            <form onSubmit={addReplay}>
              <div className="form2">
                <div><label htmlFor="replay-title">ชื่อคลิป</label><input id="replay-title" maxLength={120} placeholder="เช่น ไลฟ์เล่นเกมวันที่ ..." value={replayTitle} onChange={(event) => setReplayTitle(event.target.value)} required /></div>
                <div><label htmlFor="replay-url">ลิงก์ YouTube</label><input id="replay-url" placeholder="https://www.youtube.com/watch?v=..." value={replayUrl} onChange={(event) => setReplayUrl(event.target.value)} required /></div>
                <div><label htmlFor="replay-access">การเข้าถึง</label><select id="replay-access" value={replayAccess} onChange={(event) => setReplayAccess(event.target.value as "free" | "member")}><option value="free">ฟรีสำหรับทุกคน</option><option value="member">เฉพาะสมาชิก</option></select></div>
              </div>
              <button className="btn replay-add" type="submit">เพิ่มคลิป</button>
              <div className={`msg${replayMessage.includes("แล้ว") ? " ok" : ""}`} role="alert">{replayMessage}</div>
            </form>
            {replayError && <div className="msg" role="alert">{replayError}</div>}
            <table className="tbl"><thead><tr><th>ชื่อคลิป</th><th>ประเภท</th><th>ลิงก์</th><th></th></tr></thead>
              <tbody>{home.adminReplays.map((replay) => <tr key={replay.id}>
                <td>{replay.title}</td>
                <td><span className={`role${replay.access === "member" ? " member" : ""}`}>{replay.access === "member" ? "สมาชิก" : "ฟรี"}</span></td>
                <td><a href={replay.url} target="_blank" rel="noopener noreferrer">{replay.url}</a></td>
                <td className="table-actions"><button className="btn danger" type="button" onClick={() => setPendingDelete({ type: "replay", replay })}>ลบ</button></td>
              </tr>)}
                {!home.adminReplays.length && <tr><td colSpan={4}>ยังไม่มีคลิปย้อนหลัง</td></tr>}
              </tbody>
            </table>
          </section>
        </>}
      </main>
      {resetTarget && <div className="modal-backdrop" onMouseDown={(event) => {
        if (event.target === event.currentTarget && !resetBusy) setResetTarget("");
      }}>
        <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="reset-password-title">
          <button className="modal-close" type="button" onClick={() => setResetTarget("")} aria-label="ปิด" disabled={resetBusy}>×</button>
          <h2 id="reset-password-title">รีเซ็ตรหัสผ่าน</h2>
          <p>ตั้งรหัสผ่านใหม่ให้ {resetTarget}</p>
          <form onSubmit={resetPassword}>
            <label htmlFor="reset-password">รหัสผ่านใหม่ (6-128 ตัว)</label>
            <input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              maxLength={128}
              value={resetPasswordDraft}
              onChange={(event) => setResetPasswordDraft(event.target.value)}
              required
              autoFocus
            />
            <div className="msg" role="alert">{resetMessage}</div>
            <div className="profile-actions">
              <button className="btn ghost" type="button" onClick={() => setResetTarget("")} disabled={resetBusy}>ยกเลิก</button>
              <button className="btn" type="submit" disabled={resetBusy}>{resetBusy ? "กำลังบันทึก..." : "บันทึกรหัสผ่าน"}</button>
            </div>
          </form>
        </section>
      </div>}
      {pendingDelete && <div className="modal-backdrop" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setPendingDelete(null);
      }}>
        <section className="profile-modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-delete-title">
          <h2 id="confirm-delete-title">ยืนยันการลบ</h2>
          <p>{pendingDelete.type === "user"
            ? `ต้องการลบบัญชี ${pendingDelete.username} ใช่หรือไม่?`
            : `ต้องการลบคลิป “${pendingDelete.replay.title}” ใช่หรือไม่?`}</p>
          <div className="profile-actions">
            <button className="btn ghost" type="button" onClick={() => setPendingDelete(null)}>ยกเลิก</button>
            <button className="btn danger" type="button" onClick={() => void confirmDelete()}>ยืนยันลบ</button>
          </div>
        </section>
      </div>}
      {profileOpen && <div className="modal-backdrop" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setProfileOpen(false);
      }}>
        <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title">
          <button className="modal-close" type="button" onClick={() => setProfileOpen(false)} aria-label="ปิด">×</button>
          <h2 id="profile-title">แก้ไขโปรไฟล์</h2>
          <div className="profile-preview">
            <span className="profile-avatar large">
              <Image src={profileAvatar || "/vookcat-avatar.png"} alt="" width={72} height={72} unoptimized />
            </span>
            <div><strong>{home.username}</strong><span>อีเมลจะไม่แสดงบนหน้าเว็บ</span></div>
          </div>
          <form onSubmit={saveProfile}>
            <label htmlFor="profile-email">Gmail / อีเมล</label>
            <input id="profile-email" type="email" maxLength={254} autoComplete="email" value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} />
            <label htmlFor="profile-avatar">รูปโปรไฟล์</label>
            <input id="profile-avatar" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setProfileMessage("");
              try {
                setProfileAvatar(await createProfileAvatar(file));
              } catch (error) {
                setProfileMessage(error instanceof Error ? error.message : "อ่านไฟล์รูปไม่สำเร็จ");
              }
              event.target.value = "";
            }} />
            {profileAvatar && <button className="btn ghost remove-avatar" type="button" onClick={() => setProfileAvatar("")}>ใช้รูปเริ่มต้น</button>}
            <div className="msg" role="alert">{profileMessage}</div>
            <div className="profile-actions">
              <button className="btn ghost" type="button" onClick={() => setProfileOpen(false)}>ยกเลิก</button>
              <button className="btn" type="submit" disabled={profileBusy}>{profileBusy ? "กำลังบันทึก..." : "บันทึก"}</button>
            </div>
          </form>
        </section>
      </div>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
