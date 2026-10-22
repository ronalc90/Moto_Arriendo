import { cx } from "@/components/ui";
import { LIGHT_LABEL, type Light } from "@/lib/constants";

const dotClass: Record<Light, string> = {
  green: "bg-ok",
  yellow: "bg-[#eab308]",
  red: "bg-bad",
};
const softClass: Record<Light, string> = {
  green: "bg-ok-soft text-ok",
  yellow: "bg-warn-soft text-warn",
  red: "bg-bad-soft text-bad",
};

/** Compact pill: colored dot + label (+ late days). */
export function LightBadge({ light, lateDays }: { light: Light; lateDays?: number }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        softClass[light],
      )}
    >
      <span className={cx("size-2.5 rounded-full", dotClass[light])} aria-hidden />
      {LIGHT_LABEL[light]}
      {lateDays && lateDays > 0 ? ` · ${lateDays} ${lateDays === 1 ? "día" : "días"}` : ""}
    </span>
  );
}

/** Big three-lamp traffic light used on the driver home screen. */
export function TrafficLight({ light }: { light: Light }) {
  const lamps: Light[] = ["red", "yellow", "green"];
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-2xl bg-asphalt p-2.5"
      role="img"
      aria-label={`Semáforo: ${LIGHT_LABEL[light]}`}
    >
      {lamps.map((l) => (
        <span
          key={l}
          className={cx(
            "size-7 rounded-full transition-opacity",
            dotClass[l],
            l === light ? "opacity-100 shadow-[0_0_14px_2px_currentColor]" : "opacity-20",
          )}
          style={{ color: l === "green" ? "#22c55e" : l === "yellow" ? "#eab308" : "#ef4444" }}
        />
      ))}
    </div>
  );
}
