# AI-Enabled Product Team Vision

## Context

This document emerged from a broader discussion about how AI-enabled rapid prototyping could evolve into a new way of working for cross-functional product teams.

Several themes emerged:

* The chat started with exploring rapid prototyping and how it can move beyond just designer and developer building prototypes but also include architecture. The session explored the idea of “continuous architecture” - maintaining architecture artefacts in sync with the prototype and helping the team continuously answer: “If we wanted to move this to production now, what would it mean?”

* Many of the real barriers to delivery are not technical implementation details. They are dependencies on other teams, missing APIs, governance processes, data ownership and delivery sequencing. AI can help surface these much earlier.

* Lightweight artefacts such as markdown, YAML and ASCII wireframes may be more useful than polished documents during early exploration because they are easy for both humans and AI to reason about.

* Key business artefacts such as journey maps, research outputs and assumptions should be published in machine-readable form into a shared context repository — effectively a “Collibra for documents”.

* Rather than one generic enterprise AI, prototyping teams are more likely to benefit from a small number of specialist expert agents with different perspectives, constraints and goals. Examples discussed included a Market Research Professor, a Retirement Modelling Professor and an Architecture & Dependency Professor. These experts help the designer and developer work on specialised topics like a Retirement Planning calculator without needing to understand the subject area themselves.

* A key value of these agents comes from productive tension between them. The modelling agent may optimise for accuracy, the architecture agent for realism and delivery, and the product or research agent for client value.

* Finally, the discussion explored how this could work using current tools such as VS Code, GitHub Copilot, Claude, markdown, YAML and lightweight repository-based context in narrative “day in the life” format — not as a distant future vision, but as something that could plausibly be trialled over the next three months.

---

# Continuous Architecture

As designers and developers iterate on a prototype, AI can continuously build and maintain the answer to:

> “If we wanted to move this to production now, what would it mean?”

Rather than architecture being a separate phase, the AI can maintain a live “production delta” alongside the prototype.

Examples:

* Which existing APIs could support the screen?
* Which data elements do not exist today?
* Which other teams own the relevant dependencies?
* What governance, security or vendor onboarding steps would be required?
* Which elements could be delivered immediately, and which would require longer-term change?

This is especially powerful because many of the “real” barriers to delivery are not technical implementation details. They are:

* enterprise dependencies
* ownership boundaries
* data flows
* governance processes
* delivery sequencing

The technical decomposition into services, layers or AWS components can increasingly be generated automatically.

The harder and more valuable question is:

> “What are the implications of this idea in the real organisation?”

---

# ASCII Wireframes

ASCII wireframes and lightweight markdown artefacts appear to be particularly useful because they are:

* easy for humans to create and modify
* easy for AI to reason about
* structured enough to identify data elements and dependencies
* directly linkable to journey maps, APIs and assumptions

For example, given a screen like:

```text
+------------------------------------------------+
| Your priorities                                |
+------------------------------------------------+
| Retirement age: 60                             |
| Help with children's education: £30,000        |
|                                                |
| If you help with university costs, you are:    |
|                                                |
| [ Some risk ]                                  |
| of needing to retire 2 years later             |
|                                                |
| [ Adjust assumptions ]                         |
+------------------------------------------------+
```

An AI assistant should be able to infer:

* this requires retirement projection data
* this requires an assumption about education costs
* existing APIs may support one but not the other
* a new service or simplification may be required

ASCII wireframes may therefore be more useful than polished Figma screens during early exploration because they keep the focus on intent, data and dependencies rather than visual polish.

---

# Shared Machine-Readable Context

The chat discussed the importance of creating shared, machine-readable context.

Today, many important artefacts exist only as PowerPoint decks, Figma boards, PDFs or large visual diagrams intended for humans.

Examples include:

* journey maps
* research outputs
* client needs and jobs-to-be-done
* assumptions
* architecture decisions
* API catalogues

The proposal is to create a lightweight “Collibra for documents” model.

Key artefacts should be published into a shared context repository in a simple machine-readable form.

For example:

```yaml
journey: retirement_planning
need: balance_supporting_children_with_retirement
segment: affluent_clients_with_children
current_state: unsupported
future_state: under_exploration
related_capabilities:
  - retirement_projection
  - education_cost_assumptions
```

Potential repository structure:

```text
context/
  journey-maps/
  research/
  api-catalog/
  assumptions/
  adr/
.github/
  agents/
```

This allows both people and AI assistants to reason over the same shared context.

---

# Specialist “Professor” Agents

Rather than one generic enterprise AI, the more effective model is likely to be a small number of narrow, opinionated expert agents.

Examples:

* Market Research Professor
* Retirement Modelling Professor
* Architecture & Dependency Professor

Each agent has:

* a narrow remit
* curated context
* clear success criteria
* specific consumers of its output

For example:

### Market Research Professor

Knows:

* research reports
* adviser feedback
* client quotes
* segmentation

Produces:

* emerging themes
* linked evidence
* confidence levels
* trend analysis

### Retirement Modelling Professor

Knows:

* retirement calculations
* modelling assumptions
* regulatory constraints
* product rules

Produces:

* feasibility assessments
* required inputs
* simplification suggestions
* warnings about invalid assumptions

### Architecture & Dependency Professor

Knows:

* API catalogues
* data ownership
* team boundaries
* enterprise dependencies
* governance requirements

Produces:

* production delta
* dependency mapping
* delivery implications
* recommended MVP boundaries

These agents can support both humans and other agents.

For example, a designer with limited knowledge of retirement modelling could ask the Retirement Modelling Professor questions while designing.

---

# Avoiding “Grey Slop”

A key concern is that if AI agents simply learn to agree with each other, they stop being useful.

No disagreement = poor outcomes.

The answer is not to make the agents broader.

Instead, each agent should have:

* a different objective
* a different perspective
* different constraints
* a different definition of success

The Retirement Modelling Professor should optimise for modelling accuracy.
The Architecture Professor should optimise for realistic delivery.
The Product or Research Professor should optimise for client value.

Useful tension between them creates better outcomes.

---

# Near-Term Implementation

This does not require futuristic tooling.

A realistic three-month implementation could use:

* VS Code
* GitHub Copilot or Claude
* markdown
* YAML
* ASCII wireframes
* a small number of custom agents
* shared repository-based context

For example:

```text
.github/
  agents/
    market-research.md
    retirement-modelling.md
    architecture-dependencies.md
```

Each file could define:

* role
* goals
* allowed sources
* preferred outputs
* constraints

---

# Illustrative Future-State Story

## A Different Tuesday

Emma was halfway through her first coffee when a new Teams notification appeared.

She glanced at it, then instinctively clicked into VS Code.

The Teams notification was from the Market Research Professor.

Over the last month, the team had started experimenting with a handful of custom Copilot agents in VS Code. Most of the time they sat quietly in the background, reviewing research notes, adviser feedback and whatever the team had added to the repo.

But more and more, one of them surfaced something useful.

This felt like one of those times.

Emma clicked through.

The agent had linked the theme to a new markdown file in the repo:

```text
context/research/themes/children-vs-retirement.md
```

At the top of the file were half a dozen quotes pulled from adviser notes and client interviews.

> “We promised we'd help with university, but now I'm worried we'll never retire.”

> “I know what the pension calculator says. What I don't know is whether I can afford to support my son and still be okay.”

> “I feel guilty whichever choice I make.”

Emma stared at that last line for a moment.

Then she opened VS Code.

The repo looked a little different these days.

```text
context/
  journey-maps/
  research/
  api-catalog/
  assumptions/
  adr/
.github/
  agents/
```

The UX team had finally agreed to publish a simple machine-readable version of their journey maps alongside the Figma files.

Emma opened the relevant one.

```yaml
journey: retirement_planning
need: balance_supporting_children_with_retirement
segment: affluent_clients_with_children
current_state: unsupported
future_state: under_exploration
related_capabilities:
  - retirement_projection
  - education_cost_assumptions
```

There was no mention of a screen, or a feature, or a proposition.

Just the need.

Emma opened Figma. It felt almost crude now, but it was still the best way of sketching a new screen. Move some boxes around, add a few lines of copy, and click “export” so she could bring it into VS Code and let the Professors see it.

She hit new file, dropped the YAML in and opened Copilot Chat.

> Ask the Retirement Modelling Professor whether this makes sense.

Emma took another sip of coffee while Copilot thought. And she felt that wave of “if only my former self could see me now” coming on.

First one of the developers had shown her how to keep notes in markdown because it was easier to version and share. Then the UX team had started exporting lightweight YAML versions of their journey maps. Then someone had shown her that Claude could take a rough ASCII sketch and a few notes about interactions and generate a React screen.

At first she had resisted it. She was a designer. VS Code felt like somebody else's world.

Now she spent half her day there.

Not because she wanted to write code, but because it turned out that describing her ideas in markdown, YAML and plain text — and refining them in Copilot chat — was often more useful than polishing a perfect mock-up too early.

A few seconds later:

> This is a useful addition to bring clarity to our clients about multiple life goals and help them make important choices.
>
> I do see one issue - the screen implies a new derived outcome.
>
> Existing retirement APIs can estimate retirement age based on savings and contributions but they do not currently model university costs.
>
> Simplest MVP:
>
> * Assume three fixed education cost bands
> * Reuse existing retirement projection logic
> * Present result as “on track / some risk / significant impact”
>
> Avoid precise probability language.

Emma copied the response into the markdown file.

Then she asked the Architecture & Dependency Professor.

> Existing retirement projection API can be reused.
>
> No current API exists for university support assumptions.
>
> Creating a new service would introduce dependency on the Financial Planning Platform team.
>
> Earliest likely delivery: Q4.
>
> Recommended MVP approach: Hard-code three support bands in the journey configuration file and validate whether clients find the concept useful.

Emma smiled. Six months earlier, they would probably have spent three weeks discussing the idea before discovering that no API existed for university costs and that another team owned the dependency.

By ten-thirty, Sam from engineering had joined the call.

Emma shared her screen.

"I think we should test this," she said.

Sam looked at the sketch.

"Fine," he said. "But don't ask me to build a whole new modelling service."

Emma grinned and pointed to the Architecture Professor's response.

"Already thought about that. We can work with three bands for now."

"Okay," he said. "That's actually sensible."

By lunchtime, he had a rough React prototype running.

There was a slider for retirement age.
A second for university support.
Three buttons labelled:

* £10k
* £25k
* £50k

As Emma clicked between them, the message changed.

At £10k:

> You still appear broadly on track for retirement at 60.

At £25k:

> Supporting university costs may mean retiring later or increasing pension contributions.

At £50k:

> There is a significant risk that supporting university costs at this level could delay retirement by several years.

Emma took a screenshot and dropped it into Teams.

Two minutes later, Priya from product replied.

Emma looked back at the notes beside the prototype:

* what the clients were actually struggling with
* which parts they could build now
* which parts depended on another team
* which simplifications were acceptable for an MVP

The idea was still rough. The numbers would change. The copy would change. There would be another five versions by the end of the week.

But the shape of it was becoming clear.

At two o'clock they walked into the proposition session.

Instead, Emma put the prototype on the screen.

Then, beside it, she showed the thread that had led there:

* the original client quotes
* the journey-map YAML
* the response from the Retirement Modelling Professor
* the dependency warning from the Architecture Professor
* the decision to keep the first version simple

Then Tom, the architect, leaned forward.

"So the real dependency is only if we want fully personalised university costs?"

Emma nodded.

"For now we can do this with the APIs we already have."

Marcus from the modelling team looked relieved.

"Good," he said. "Because my team definitely can't build a new service before Q4."

Priya was still looking at the client quote on the left-hand side of the screen.

> I feel guilty whichever choice I make.

"That's the thing," she said quietly. "We've spent years giving people projections. But what they're really asking for is help making trade-offs."

Emma glanced back at the prototype.

It was not polished. The colours were wrong. One of the buttons was slightly misaligned. The text would probably be rewritten tomorrow.

But they understood why it mattered, what it would take to make it real, and what the simplest honest version looked like.

By the time she got back to her desk, the team had already dropped three new comments in the Teams chat.

Emma smiled, opened VS Code again, and started a new file.
