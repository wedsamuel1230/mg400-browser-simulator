---
name: MG400 Lab
description: Classroom robot learning workspace
colors:
  primary: "#235dcc"
  primary-deep: "#184cae"
  primary-soft: "#edf3ff"
  canvas: "#f5f7fb"
  surface: "#ffffff"
  ink: "#172b45"
  muted: "#52647b"
  line: "#d5dde8"
  viewport: "#10171a"
  success: "#17694d"
  error: "#a32c36"
typography:
  heading:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans TC, sans-serif"
    fontSize: "clamp(26px, 2.3vw, 34px)"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Noto Sans TC, sans-serif"
    fontSize: "18px"
    lineHeight: 1.6
  label:
    fontSize: "16px"
    lineHeight: 1.45
  code:
    fontFamily: "SFMono-Regular, Consolas, Liberation Mono, monospace"
    fontSize: "16px"
    lineHeight: 1.75
rounded:
  input: "6px"
  button: "8px"
  panel: "10px"
  worktable: "12px"
spacing:
  small: "8px"
  medium: "16px"
  section: "24px"
  workspace: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "12px 18px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "8px 13px"
    height: "44px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
    padding: "8px"
---

## Overview

**Creative North Star: "A classroom workbench with a visible next step"**

The interface makes practice, code and results easy to distinguish. It uses clear reading surfaces around a live, dark 3D worktable. Traditional Chinese is the first-use language. Native controls and system text keep the application familiar and responsive.

**Key Characteristics:**
- Generous reading text and labelled actions.
- Blue indicates actions and selected navigation.
- One workspace destination at a time.
- Technical details unfold when needed.

## Colors

Blue is the single primary accent. White panels sit on a cool neutral canvas. Navy text and slate explanations carry content; green and red communicate outcomes. The dark worktable is a content surface, not the reading theme.

**The Action Color Rule.** Use primary blue for the principal action, selected navigation and keyboard focus.

## Typography

Use the system sans family for instructional text and headings. Lesson prose stays at 18px with 1.8 line height. Code uses monospace and stays at 16px on desktop; compact metadata uses 14–16px. Main headings shrink to 28px on phones.

**The Reading Rule.** Do not shrink lesson paragraphs to fit more controls into the viewport.

## Layout

The desktop grid uses a task column and flexible worktable, separated by 32px. Code receives a wider column. Below 900px the workspace stacks into one column. At 600px, padding becomes 16px and the worktable is 350px high. The canvas is absolutely positioned within its explicitly sized container to prevent intrinsic resize feedback.

**The One Destination Rule.** Show practice, code, taught-point controls, free objects or settings as separate destinations; never display every editor simultaneously.

## Elevation & Depth

Borders separate normal surfaces. Only the project menu and optional AI drawer use soft shadows. The lesson dialog uses a translucent navy backdrop. Loading feedback overlays the worktable with readable progress text.

## Shapes

Inputs, buttons and panels have gently rounded corners. Avoid using ornamental pills for long names or descriptions. Selection lists use full-width rows with enough room for two lines.

## Components

Buttons have a 44px minimum target; the principal action is 48px. Hover retains contrast, and keyboard focus uses a visible 3px outline. The dark keyboard-placement canvas uses a pale yellow ring. Numeric values remain readable when disabled.

Practice steps use a numbered vertical sequence. Prepared steps use a check; the current step uses blue. Result text remains directly below the worktable. Lesson references, code previews and quizzes use native expandable sections. Free objects can be placed by pointer or keyboard and remain editable through numeric fields.

## Do's and Don'ts

### Do:
- Do keep the next action labelled and near the object it affects.
- Do keep lesson paragraphs at 18px.
- Do show progress, errors and results in plain language.
- Do retain focus indicators and keyboard placement.

### Don't:
- Don't expose calibration and object tables on the novice home screen.
- Don't rely on tiny text or unlabeled icons for essential actions.
- Don't imply physical collision or magnetic-force simulation.
