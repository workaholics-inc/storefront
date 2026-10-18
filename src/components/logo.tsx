export function Logo({ withWordmark = true }: { withWordmark?: boolean }) {
  return (
    <span dir="ltr" className="inline-flex items-center gap-[0.55rem]">
      <svg
        viewBox="0 0 61 38"
        className={withWordmark ? "h-[22px] w-auto" : "h-6 w-auto"}
        {...(withWordmark
          ? { "aria-hidden": true }
          : { role: "img", "aria-label": "Workaholics" })}
      >
        <polygon
          className="fill-logo"
          points="0,0 18,0 20.5,9 23,0 38,0 40.5,9 43,0 61,0 54,38 34,38 30.5,29.5 27,38 7,38"
        />
        <path
          className="fill-logo-eye"
          d="M17 18C22 10.5 39 10.5 44 18C39 25.5 22 25.5 17 18Z"
        />
        <circle className="fill-logo-pupil" cx="30.5" cy="18" r="5" />
      </svg>
      {withWordmark ? (
        <span
          lang="en"
          className="text-[21px] leading-none font-extrabold tracking-[-0.012em] text-ink lowercase"
        >
          workaholics
        </span>
      ) : null}
    </span>
  );
}
