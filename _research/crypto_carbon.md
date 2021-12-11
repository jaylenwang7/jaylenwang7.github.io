---
title: "Crypto Hardware Carbon Project"
collection: research
permalink: /research/crypto_carbon
type: "Research Project"
venue: "Harvard Architecture, Circuits, and Compilers Group"
date: 2021-12-01
---

# Project Goal:
Given previous research finding that, for many computing applications, manufacturing related carbon emissions (AKA capex emissions) can dominate the device's overall carbon footprint, I'm looking to see how this applies to cryptocurrency mining. This boils down to a couple of subgoals:
* Estimate the capex carbon footprint of manufacturing mining hardware
* Understand how the proof-of-work algorithms of different cryptocurrencies affect HW/ASIC design and how this leads to different emission characteristics
* Combine this with previous research of operational emissions to get a more holistic understanding of emissions

# Project Status:
* I've successfully developed a prototype of a Bitcoin mining ASIC (specialized double SHA-256 accelerator) using C++ HLS
* Have used this ASIC design to obtain area and energy numbers to estimate capex footprint
* I'm currently looking into Ethereum (ethash) accelerators to compare them to Bitcoin (SHA-256)

### Background:
Cryptocurrencies have been increasing in popularity in recent years. Among them is Bitcoin, the first of these decentralized cryptocurrencies and by far the most popular. With cryptocurrencies constantly in the news and many touting it as a replacement for physical currency, many have raised the alarm in terms of how the mining of such cryptocurrencies could exacerbate global warming.

As an example, Bitcoin mining is extremely energy intensive, with previous research estimating that Bitoin mining alone produces emissions on the level of countries like Chile and Finland. Mining essentially boils down to individuals using hardware, often specialized hardware like graphic processing units (GPUs) and application specific integrated circuits (ASICs), to perform as many hashes using a certain algorithm as possible. This mining is a competition, whereby individuals around the world race to achieve a hash output under a certain threshold, upon which their hash input is used as “proof of work” (PoW). Miners who achieve this PoW before anybody else receive compensation in the form of fees from users making bitcoin transactions as well as newly created bitcoin. Because of the competitive and lucrative nature of mining, more and more miners are joining the race using more complex hardware.

There has been a good amount of research looking into the potential energy consumption and carbon costs of Bitcoin. None of this research, however, has taken a very holistic view of energy consumption beyond just the operating costs of mining. Most importantly, no research has looked at the costs associated with manufacturing the hardware used for bitcoin mining. From previous research done by a graduate student at Harvard (Udit Gupta) we know that “capex”, i.e. one time costs like manufacturing, costs can make up a large portion, sometimes a majority depending on the application, of the total carbon footprint of using hardware. Just as an example, for Apple 74% of total emissions come from manufacturing while only 19% is derived from actual product use.

### Project Presentation
See the following presentation I gave to my lab group for a more detailed description of the project and current results:
<object data="https://jaylenwang7.github.io/files/Crypto_Capex_Carbon.pdf" type="Crypto/pdf" width="700px" height="700px">
    <embed src="https://jaylenwang7.github.io/files/Crypto_Capex_Carbon.pdf">
        <p>This browser does not support PDFs. Please download the PDF to view it: <a href="https://jaylenwang7.github.io/files/Crypto_Capex_Carbon.pdf">Download PDF</a>.</p>
    </embed>
</object>
