/** @type {import('tailwindcss').Config} */
import typography from "@tailwindcss/typography";
export default {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        modal: {
          background: "#14120C",
          input: "#201D15",
          primary: "#F3CE49",
          secondary: "#8A8272",
          muted: "#B0A794",
        },
        surface: {
          DEFAULT: "#070605",
          card: "#0F0D09",
          elevated: "#1C1913",
          outline: "#14120C",
          background: "#1C1913",
          divider: "#4A4436",
          button: "#8A8272",
          text: "#B0A794",
        },
        border: {
          DEFAULT: "#201D15",
          hover: "#35301F",
        },
        content: {
          DEFAULT: "#FAF7EF",
          muted: "#9A927F",
          icon: "#3a3a3a",
        },
        status: {
          "success-bg": "rgba(16, 185, 129, 0.1)",
          "success-border": "rgba(16, 185, 129, 0.4)",
          "success-text": "#6ee7b7",
          "success-badge-bg": "rgba(16, 185, 129, 0.15)",
          "fail-bg": "rgba(244, 63, 94, 0.1)",
          "fail-border": "rgba(244, 63, 94, 0.4)",
          "fail-text": "#fda4af",
          "fail-solid": "#dc2626",
          "fail-solid-hover": "#b91c1c",
        },
        toggle: {
          active: "#34d399",
          "active-bg": "rgba(52, 211, 153, 0.2)",
          "active-border": "rgba(52, 211, 153, 0.5)",
          inactive: "#242424",
          "inactive-knob": "#8c8c8c",
          "inactive-border": "#3a3a3a",
        },
        "muted-overlay": "rgba(5, 5, 5, 0.4)",
        "pill-bg": "rgba(31, 31, 31, 0.3)",
      },
    },
  },
  plugins: [typography],
};
