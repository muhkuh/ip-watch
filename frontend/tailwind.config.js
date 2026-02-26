/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        primary: "var(--color-primary)",
        accent: "var(--color-accent)",
        danger: "var(--color-danger)",
        warning: "var(--color-warning)",
        text: "var(--color-text)",
        muted: "var(--color-muted)"
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)"
      },
      fontFamily: {
        heading: ["var(--font-heading)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"]
      }
    }
  },
  plugins: []
};
