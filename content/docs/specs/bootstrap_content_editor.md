I am planning to build a module to support the nuxt-content <ContentRenderer> component input as it receives from parsing the source .md files. I want to be able to use a builder to generate an output array compatible with nuxt-content where I can put in my set of custom developed VueJS components and assign props to them.

A sample data array needed by ContentRenderer is:

[
[
"pricing-hero",
{
":ctaIsLogin": "true"
},
[
"template",
{
"v-slot:title": ""
},
[
"p",
{},
"Introducing",
[
"br",
{}
],
"\nthe POW Lab"
]
],
[
"template",
{
"v-slot:subtitle": ""
},
[
"p",
{},
"Bitvocation's Inner Circle for Bitcoin Professionals. A small, powerful community to help you get noticed by the right people, find your first job in Bitcoin and build a career you're excited about."
]
],
[
"template",
{
"v-slot:cta": ""
},
[
"p",
{},
"Join the POW Lab"
]
]
],
[
"bullets-section",
{
":cards": "[{\"title\":\"Network\",\"icon\":\"mage:globe\",\"description\":\"<ul>\\n  <li><strong>Join</strong>: A private Telegram group of Bitcoin professionals</li>\\n  <li><strong>Grow</strong>: Your LinkedIn presence to attract recruiters</li>\\n  <li><strong>Be Listed</strong>: Pseudonymously in our job seeker database</li>\\n</ul>\\n\"},{\"title\":\"Proof of Work\",\"icon\":\"flowbite:flag-solid\",\"description\":\"<ul>\\n  <li><strong>Document</strong>: Your Bitcoin journey with our LinkedIn guide</li>\\n  <li><strong>Contribute</strong>: Real projects via Bitvocation's Talent Exchange</li>\\n  <li><strong>Build</strong>: A public portfolio that shows your Bitcoin impact</li>\\n</ul>\\n\"}]",
"preTitle": "In Bitcoin",
"subtitle": "It shows who you are, what you've done, and why it matters. POW Lab helps you demonstrate your undeniable proof of work—while building meaningful connections.",
"theme": "light",
"title": "Proof of Work is everything"
}
],
[
"callout-section",
{},
[
"template",
{
"v-slot:title": ""
},
[
"p",
{},
"Our Vision:",
[
"br",
{}
],
"\n100 Bitcoiners, Ready to Build."
]
],
[
"template",
{
"v-slot:subtitle": ""
},
[
"p",
{},
"We are not a recruitment agency; we are your advocates. Our short-term goal is to grow a 100 - strong talent pool of Bitcoin professionals."
]
],
[
"template",
{
"v-slot:cta": ""
},
[
"p",
{},
"Join Us!"
]
]
],
[
"pow-lab-section",
{
"authorName": "Tanja Bächle",
"authorTitle": "POW Lab Alumni",
"image": "/images/Tanja20Testimonial.jpg"
},
[
"template",
{
"v-slot:preTitle": ""
},
[
"p",
{},
"Who should join?"
]
],
[
"template",
{
"v-slot:title": ""
},
[
"p",
{},
"POW Lab"
]
],
[
"template",
{
"v-slot:description": ""
},
[
"p",
{},
"You're not here to browse. You're here to build, prove it, and get hired."
]
],
[
"template",
{
"v-slot:bullets": ""
},
[
"bullet-point",
{
"icon": "mdi:face"
},
[
"p",
{},
[
"strong",
{},
"You're serious"
],
" about working in Bitcoin — not just lurking"
]
],
[
"bullet-point",
{
"icon": "mdi:face-cool"
},
[
"p",
{},
[
"strong",
{},
"You thrive"
],
" in signal-rich communities where proof beats talk."
]
],
[
"bullet-point",
{
"icon": "mdi:face-sad"
},
[
"p",
{},
[
"strong",
{},
"You're done"
],
" with fiat jobs and want to align your work with Bitcoin ethos."
]
]
],
[
"template",
{
"v-slot:testimonial": ""
},
[
"p",
{},
"I didn’t apply for the job. A job was created for me."
]
]
],
[
"pricing-section",
{
"preTitle": "Contribution"
},
[
"template",
{
"v-slot:title": ""
},
[
"p",
{},
"What Does it Cost?"
]
],
[
"template",
{
"v-slot:subtitle": ""
},
[
"p",
{},
"We offer two membership tiers:"
]
],
[
"template",
{
"v-slot:titleFirst": ""
},
[
"p",
{},
"POW Lab Pro"
]
],
[
"template",
{
"v-slot:priceFirst": ""
},
[
"p",
{},
"88,888 sats"
]
],
[
"template",
{
"v-slot:descriptionFirst": ""
},
[
"p",
{},
"Unlock full access"
]
],
[
"template",
{
"v-slot:ctaFirst": ""
},
[
"p",
{},
"I want to join!"
]
],
[
"template",
{
"v-slot:featuresFirst": ""
},
[
"feature-item",
{},
[
"p",
{},
"Access to private Telegram group with Anja & other Bitcoiners"
]
],
[
"feature-item",
{},
[
"p",
{},
"\"LinkedIn for Bitcoiners\" growth guide"
]
],
[
"feature-item",
{},
[
"p",
{},
"Inclusion in our talent pool"
]
],
[
"feature-item",
{},
[
"p",
{},
"Access to exclusive tools, i.e. AI CV Doctor"
]
],
[
"feature-item",
{},
[
"p",
{},
"Preferred invites to contribute to real-world projects via BTX"
]
],
[
"feature-item",
{},
[
"p",
{},
"Celebrate and support on every step in your journey!"
]
]
],
[
"template",
{
"v-slot:titleSecond": ""
},
[
"p",
{},
"POW Lab Lite"
]
],
[
"template",
{
"v-slot:priceSecond": ""
},
[
"p",
{},
"21,000 sats"
]
],
[
"template",
{
"v-slot:descriptionSecond": ""
},
[
"p",
{},
"Just to get started"
]
],
[
"template",
{
"v-slot:ctaSecond": ""
},
[
"p",
{},
"Coming Soon"
]
],
[
"template",
{
"v-slot:featuresSecond": ""
},
[
"feature-item",
{},
[
"p",
{},
"Inclusion in our talent pool"
]
],
[
"feature-item",
{},
[
"p",
{},
"Access to our web job feed"
]
]
]
],
[
"faq-section",
{},
[
"template",
{
"v-slot:title": ""
},
[
"p",
{},
"Frequently Asked Questions"
]
],
[
"template",
{
"v-slot:questions": ""
},
[
"faq-item",
{},
[
"template",
{
"v-slot:question": ""
},
[
"p",
{},
"How to Join?"
]
],
[
"template",
{
"v-slot:answer": ""
},
[
"p",
{},
"Right now, the POW Lab is in its Early Adopter phase, and membership can be purchased as a reward through GeyserFund. If this sounds like a community you've been searching for, join us!"
]
]
],
[
"faq-item",
{},
[
"template",
{
"v-slot:question": ""
},
[
"p",
{},
"I don't know how to make a payment through Lightning Network. Is there another way to pay?"
]
],
[
"template",
{
"v-slot:answer": ""
},
[
"p",
{},
"Unfortunately not. We aim to attract only Bitcoin enthusiasts to this group and being able to use Bitcoin is therefore an important requirement for us. If you don't know yet how a Lightning Wallet works, you can easily learn it. Strike.me is a very convenient (custodial) service to use for beginners, and there are lots of other options, including self-custodial ones. Since we work with Bitcoin-only employers, we want to ensure that we attract only true Bitcoin enthusiasts who are not afraid to use the technology."
]
]
],
[
"faq-item",
{},
[
"template",
{
"v-slot:question": ""
},
[
"p",
{},
"I know how to make a Lightning payment, but I don't want to spend my bitcoin! Can't I just pay in fiat?"
]
],
[
"template",
{
"v-slot:answer": ""
},
[
"p",
{},
"Nope. As per above - we have to use LN payments as an important filter to assure that we only attract the right people to the group. We do understand you want to hold and prefer not to spend your bitcoin, but have you ever heard of \"Spend and replace\"? ;)::"
]
]
],
[
"faq-item",
{},
[
"template",
{
"v-slot:question": ""
},
[
"p",
{},
"What happens after the 6 months?"
]
],
[
"template",
{
"v-slot:answer": ""
},
[
"p",
{},
"It's up to you! You can let your membership run out and leave our Telegram group (you get to keep all the resources you received). Or you can renew for another 6 months. If you feel you don't need the support in the group anymore, but would like to remain in our talent pool, you can also simply opt for the POW Lab Lite version."
]
]
],
[
"faq-item",
{},
[
"template",
{
"v-slot:question": ""
},
[
"p",
{},
"Is there a guarantee I'll get a job?"
]
],
[
"template",
{
"v-slot:answer": ""
},
[
"p",
{},
"No, we can't guarantee employment. The POW Lab provides you with the tools, network, and visibility to significantly increase your chances, but ultimately your success depends on your engagement with the community and the effort you put into building your proof of work."
]
]
]
]
],
[
"key-message-section",
{
"buttonLink": "https://bitvocation.substack.com/",
"buttonText": "Get the Free Guide",
"icon": "icon-park-solid:seedling"
},
[
"template",
{
"v-slot:title": ""
},
[
"p",
{},
"I didn’t apply for the job. A job was created for me."
]
],
[
"template",
{
"v-slot:description": ""
},
[
"p",
{},
"Thanks to the unwavering support of the Bitvocation team, I didn’t just find a role—I found a place in Bitcoin. And not through an application or a job board. A CEO reached out, asked what I love doing, what I’m good at—and then created a role around that. That’s what happens when your proof of work speaks louder than your CV.\n",
[
"br",
{}
],
[
"br",
{}
],
"\nI’m not a developer. I’m not technical. I’ve been in Bitcoin for just about a year. But what Bitvocation gave me wasn’t just advice or job listings—it was belief.\n",
[
"br",
{}
],
[
"br",
{}
],
"\nThey held space when I doubted myself. They nudged me when I needed direction. They reflected my strengths back to me when I couldn’t see them clearly. They reminded me that being a Bitcoiner is enough—that showing up, learning, building, and caring is what this space is all about.\n",
[
"br",
{}
],
[
"br",
{}
],
"\nThe POW Lab isn’t some course. It’s community. It's coaching without the buzzwords. It’s the human side of proof of work.\n",
[
"br",
{}
],
[
"br",
{}
],
"\nBitvocation didn’t just help me get a job. They helped me see myself as part of the mission. And once you feel that? You’ll never look at “career” the same way again."
]
]
],
[
"callout-section",
{
"background": "white"
},
[
"template",
{
"v-slot:title": ""
},
[
"p",
{},
"Ready to Join?"
]
],
[
"template",
{
"v-slot:subtitle": ""
},
[
"p",
{},
"If all of the above sounds good to you, hit the button below and join us through GeyserFund. There are about 30 Bitcoiners looking forward to meeting you!"
]
],
[
"template",
{
"v-slot:cta": ""
},
[
"p",
{},
"Join POW Lab!"
]
]
]
]


with the corresponding .md file being:

---
title: Introducing the POW Lab
description: Choose the perfect plan for your needs
---

::PricingHero
---
ctaIsLogin: true
---
#title
Introducing<br>
the POW Lab

#subtitle
Bitvocation's Inner Circle for Bitcoin Professionals. A small, powerful community to help you get noticed by the right people, find your first job in Bitcoin and build a career you're excited about.

#cta
Join the POW Lab
::

::BulletsSection
---
theme: light
preTitle: In Bitcoin
title: Proof of Work is everything
subtitle: It shows who you are, what you've done, and why it matters. POW Lab helps you demonstrate your undeniable proof of work—while building meaningful connections.
cards:
- title: Network
  icon: mage:globe
  description: |
    <ul>
      <li><strong>Join</strong>: A private Telegram group of Bitcoin professionals</li>
      <li><strong>Grow</strong>: Your LinkedIn presence to attract recruiters</li>
      <li><strong>Be Listed</strong>: Pseudonymously in our job seeker database</li>
    </ul>
- title: Proof of Work
  icon: flowbite:flag-solid
  description: |
    <ul>
      <li><strong>Document</strong>: Your Bitcoin journey with our LinkedIn guide</li>
      <li><strong>Contribute</strong>: Real projects via Bitvocation's Talent Exchange</li>
      <li><strong>Build</strong>: A public portfolio that shows your Bitcoin impact</li>
    </ul>
---
::

::CalloutSection
---
---
#title
Our Vision:  
100 Bitcoiners, Ready to Build.

#subtitle
We are not a recruitment agency; we are your advocates. Our short-term goal is to grow a 100 - strong talent pool of Bitcoin professionals.

#cta
Join Us!
::

::PowLabSection
---
authorName: "Tanja Bächle"
authorTitle: "POW Lab Alumni"
image: "/images/Tanja20Testimonial.jpg"
---

#preTitle
Who should join?

#title
POW Lab

#description
You're not here to browse. You're here to build, prove it, and get hired.

#bullets

::bullet-point{icon="mdi:face"}
__You're serious__ about working in Bitcoin — not just lurking
::

::bullet-point{icon="mdi:face-cool"}
__You thrive__ in signal-rich communities where proof beats talk.
::

::bullet-point{icon="mdi:face-sad"}
__You're done__ with fiat jobs and want to align your work with Bitcoin ethos.
::

#testimonial
I didn’t apply for the job. A job was created for me.

::


::PricingSection
---
preTitle: "Contribution"
---
#title
What Does it Cost?

#subtitle
We offer two membership tiers:

#titleFirst
POW Lab Pro

#priceFirst
88,888 sats

#descriptionFirst
Unlock full access

#ctaFirst
I want to join!

#featuresFirst

::feature-item
Access to private Telegram group with Anja & other Bitcoiners
::

::feature-item
"LinkedIn for Bitcoiners" growth guide
::

::feature-item
Inclusion in our talent pool
::

::feature-item
Access to exclusive tools, i.e. AI CV Doctor
::

::feature-item
Preferred invites to contribute to real-world projects via BTX
::

::feature-item
Celebrate and support on every step in your journey!
::

#titleSecond
POW Lab Lite

#priceSecond
21,000 sats

#descriptionSecond
Just to get started

#ctaSecond
Coming Soon

#featuresSecond

::feature-item
Inclusion in our talent pool
::

::feature-item
Access to our web job feed
::

::

::faq-section
#title
Frequently Asked Questions

#questions
::faq-item
#question
How to Join?

#answer
Right now, the POW Lab is in its Early Adopter phase, and membership can be purchased as a reward through GeyserFund. If this sounds like a community you've been searching for, join us!
::

::faq-item
#question
I don't know how to make a payment through Lightning Network. Is there another way to pay?

#answer
Unfortunately not. We aim to attract only Bitcoin enthusiasts to this group and being able to use Bitcoin is therefore an important requirement for us. If you don't know yet how a Lightning Wallet works, you can easily learn it. Strike.me is a very convenient (custodial) service to use for beginners, and there are lots of other options, including self-custodial ones. Since we work with Bitcoin-only employers, we want to ensure that we attract only true Bitcoin enthusiasts who are not afraid to use the technology.
::

::faq-item
#question
I know how to make a Lightning payment, but I don't want to spend my bitcoin! Can't I just pay in fiat?

#answer
Nope. As per above - we have to use LN payments as an important filter to assure that we only attract the right people to the group. We do understand you want to hold and prefer not to spend your bitcoin, but have you ever heard of "Spend and replace"? ;)::
::

::faq-item
#question
What happens after the 6 months?

#answer
It's up to you! You can let your membership run out and leave our Telegram group (you get to keep all the resources you received). Or you can renew for another 6 months. If you feel you don't need the support in the group anymore, but would like to remain in our talent pool, you can also simply opt for the POW Lab Lite version.
::

::faq-item
#question
Is there a guarantee I'll get a job?

#answer
No, we can't guarantee employment. The POW Lab provides you with the tools, network, and visibility to significantly increase your chances, but ultimately your success depends on your engagement with the community and the effort you put into building your proof of work.
::

::

::KeyMessageSection
---
icon: "icon-park-solid:seedling"
buttonText: "Get the Free Guide"
buttonLink: "https://bitvocation.substack.com/"
---

#title
I didn’t apply for the job. A job was created for me.

#description
Thanks to the unwavering support of the Bitvocation team, I didn’t just find a role—I found a place in Bitcoin. And not through an application or a job board. A CEO reached out, asked what I love doing, what I’m good at—and then created a role around that. That’s what happens when your proof of work speaks louder than your CV.
<br><br>
I’m not a developer. I’m not technical. I’ve been in Bitcoin for just about a year. But what Bitvocation gave me wasn’t just advice or job listings—it was belief.
<br><br>
They held space when I doubted myself. They nudged me when I needed direction. They reflected my strengths back to me when I couldn’t see them clearly. They reminded me that being a Bitcoiner is enough—that showing up, learning, building, and caring is what this space is all about.
<br><br>
The POW Lab isn’t some course. It’s community. It's coaching without the buzzwords. It’s the human side of proof of work.
<br><br>
Bitvocation didn’t just help me get a job. They helped me see myself as part of the mission. And once you feel that? You’ll never look at “career” the same way again.
::

::callout-section{background="white"}
#title
Ready to Join?

#subtitle
If all of the above sounds good to you, hit the button below and join us through GeyserFund. There are about 30 Bitcoiners looking forward to meeting you!

#cta
Join POW Lab!
::


Make a PRD document in the /docs folder with the full implementation plan.


Evaluate and consider this partial plan that was generated previously and build upon that:

## 1. Executive Summary

This document outlines the requirements for implementing a visual site builder module that will enable content creators to build pages using custom Vue components and generate compatible data arrays for Nuxt Content's ContentRenderer component.

## 2. Project Overview

### 2.1 Problem Statement
Content creators currently need to manually write complex nested arrays in Markdown files to utilize custom Vue components with Nuxt Content. This process is error-prone, time-consuming, and requires technical expertise.

### 2.2 Solution
Develop a visual site builder that allows users to:
- Drag and drop custom Vue components
- Configure component props through an intuitive UI
- Generate compatible data arrays for ContentRenderer
- Preview changes in real-time

## 3. Functional Requirements

### 3.1 Core Features

#### 3.1.1 Component Library
_Status (2025-09-25): ✅ MVP registry implemented via `useComponentRegistry` with component metadata, prop schemas, and factory helpers._
- **Component Registry**: Maintain a registry of available Vue components
- **Drag-and-Drop Interface**: Visual interface for adding components to pages
- **Component Properties Panel**: Configure props for selected components
- **Component Preview**: Real-time preview of component rendering

#### 3.1.2 Data Structure Generation
_Status (2025-09-25): ✅ Serialization utilities in `app/utils/contentBuilder.ts` create ContentRenderer-compatible arrays, including slot handling._
- **Array Format Compatibility**: Generate arrays compatible with ContentRenderer
- **Nested Component Support**: Handle nested components and slots
- **Prop Serialization**: Properly serialize component props to the expected format
- **Template Handling**: Support for v-slot templates within components

#### 3.1.3 Visual Editor
_Status (2025-09-25): ⚠️ Builder at `/builder` now supports root-level drag-and-drop ordering, spacing presets, and live preview; nested drag UX still pending._
- **Canvas Interface**: Main editing area for page layout
- **Component Palette**: Sidebar with available components
- **Inspector Panel**: Properties configuration for selected components
- **Preview Mode**: Real-time rendering of the page

### 3.2 Technical Requirements

#### 3.2.1 Data Format
_Status (2025-09-25): ✅ Generated arrays adhere to the documented minimal content structure (`serializeTree`)._
The builder must generate arrays in this format:
```javascript
[
  ["component-name", { props }, [nested-components]],
  ["component-name", { props }, [nested-components]]
]
```

#### 3.2.2 Component Support
- **Basic Components**: Simple components with props
- **Template Components**: Components with v-slot templates
- **Nested Components**: Support for deeply nested component structures
- **Dynamic Props**: Support for dynamic prop values (strings, objects, arrays)

## 4. User Interface Design
