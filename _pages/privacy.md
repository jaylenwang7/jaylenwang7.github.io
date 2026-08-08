---
permalink: /privacy/
title: "Privacy"
excerpt: "What this site and its reader-interaction service collect and store."
author_profile: false
---

*Last updated August 8, 2026.*

This page describes data handled when you visit this site or use the like control on a writing entry. The site has no reader accounts, and likes do not collect a name or email address.

## Site analytics

This site uses Clicky to understand visits and which pages are useful. The account-wide **Visitor privacy** setting is **All visitors** (verified August 7, 2026). With that setting, Clicky anonymizes visitors' IP addresses, disables its tracking cookies, and honors the global opt-out preference. The site also explicitly tells the Clicky script not to set cookies as a second layer of protection.

Clicky still receives ordinary page-view information, such as the page visited and browser or referrer information, in order to produce site analytics. It does not receive the browser identifier described below from this site.

## Likes on writing entries

When a like-enabled entry loads, it first asks the interactions service for the public like count. If browser storage is unavailable, that count is all that appears: the page does not create an identifier or show a like button.

The first time you press **Like**, the page creates a random browser identifier and saves it in your browser's local storage under `jw.visitor.v1`. It also keeps a local set of entries you have liked under `jw.liked.v1`, so it can paint the remembered heart state while checking it against the service. This identifier is not a name, email address, account, cookie, or fingerprint.

After that first interaction, visits to a like-enabled writing entry send the browser identifier to the interactions service with the count request. This lets the service return whether this browser liked that entry and correct stale local state. It also means the service can see that the same browser identifier opened that particular entry. Identified requests are made only on individual entries where the like control is rendered—never on the writing index or unrelated pages.

The service does not store the raw browser identifier in its database. For each entry, it stores a keyed, one-way hash made from the entry id and browser identifier, along with the time of the like. Because the entry id is part of that hash, stored like records cannot be linked across entries by their hash. It also stores an entry registry and a denormalized total count. Counts are public; individual like records are not exposed by the API.

Clearing this site's local storage removes the identifier and remembered heart states from that browser. The service cannot then recognize the browser's earlier likes, and a later click may count as a new anonymous browser. Removing a like changes the total and deletes that entry's hashed like record.

## Infrastructure and request data

The static site is served by GitHub Pages. The interactions API and database run on Cloudflare. Cloudflare necessarily processes interaction requests, including their network address. On write requests, the application also uses the address in Cloudflare's short-window rate limiter to limit abuse. The application code does not write IP addresses to D1 or to an application log.

The services involved may process operational request data under their own policies. This site does not sell reader data or provide like records to advertisers.
