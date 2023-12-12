---
title: "DNN Accelerator Resilience"
collection: research
permalink: /research/DNN_resilience
type: "Research Project"
venue: "Harvard Architecture, Circuits, and Compilers Group"
date: 2021-12-01
---

A current research project I'm leading within the Harvard Architecture, Circuits, and Compilers Group with the help of [Abdulrahman Mahmoud](https://ma3mool.github.io/). The project aims to develop a software framework for analyzing a DNN accelerator's resilience to errors (particularly bit flips caused by soft errors). The project's novel approach is to use dataflow loop nest analysis to understand how an erroneous value in the memory hierarchy will be reused at the software-visible output activation level.

# Project Goal:
[Previous research](https://www.microarch.org/micro53/papers/738300a270.pdf) introduced the idea of modeling how errors in datapath flip-flops (FFs) propagate in DNN accelerators by determining for which outputs neurons that FF's value is reused for. This project expands and develops this idea further by developing a tool that will use the loop nest description of a workload (network layer) mapped onto an accelerator to analyze how this will result in different "dataflow error sites" - meaning output neurons that will be affected by an error occurring in some time and place in the accelerator's memory hierarchy. 

# Project Background:
With CMOS technology nodes approaching scales of a few nanometers, this makes them more susceptible to hardware transient faults, in particular to soft errors, which are temporary errors in hardware computation mainly caused by radiation and temperature effects. The effect of these soft errors are very program dependent, one example being that deep neural networks (DNNs) tend to have orders of magnitude more fault tolerance than traditional computation. Even between different DNN models the resilience can differ drastically due to variations in the number of weights, layers, and input sizes of the models. Moreover, the effect of soft errors on DNN computation is also hardware dependent, as the underlying hardware can affect the overall resilience as well as how vulnerable certain types of computation is, which is important to understand for mitigation. This is because different hardware accelerators will move and reuse data differently, leading to varying vulnerability. Thus, it is important to be able to understand how the design of an accelerator and its memory hiearchy will affect its overall resilience if it is to be deployed in safety critical settings. 
