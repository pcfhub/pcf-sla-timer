---
title: Installation
description: Import the solution and make the control available.
order: 2
---

# Installation

:::steps
1. Download the **managed** solution for your environment.
2. In the Power Platform admin centre, import the solution.
3. Publish all customizations.
4. Enable **Code components for canvas apps** if this control is used there.
:::

:::callout{type=warning}
Import the managed solution into production. The unmanaged one is for a
development environment where you intend to change the control itself — it
cannot be cleanly uninstalled.
:::

## Requirements

Any environment that supports code components. The control is a standard PCF
control with no platform libraries and no external dependencies, so there is
nothing to install first and no minimum framework version beyond the one code
components themselves need.

The import prompts for **no permissions**. The manifest declares no
`uses-feature` entries because the control calls neither Web API, Utility nor
Device — worth knowing if consent prompts are what usually stalls an approval.

## Where it can go

The bound property is a **Date and Time** column. On a model-driven form, that
is the column the control replaces. In a canvas app, it is whatever date the
formula supplies.

The control renders text in a 32px-high field surface, so it sits in an ordinary
form column without any layout work. It has no minimum width — the readout
truncates with an ellipsis rather than overflowing.
