'use client'
import {useEffect,useRef,useState,type RefObject} from 'react'
import gsap from 'gsap'
import {ScrollTrigger} from 'gsap/ScrollTrigger'
gsap.registerPlugin(ScrollTrigger)
export function useScrollProgress(runwayRef:RefObject<HTMLDivElement|null>){const progress=useRef(0);useEffect(()=>{if(!runwayRef.current)return;const ctx=gsap.context(()=>{ScrollTrigger.create({trigger:runwayRef.current,start:'top top',end:'bottom bottom',scrub:.4,onUpdate:self=>{progress.current=self.progress}})},runwayRef);return()=>ctx.revert()},[runwayRef]);return progress}
export function useIsMobile(){const [mobile,setMobile]=useState(false);useEffect(()=>{const mq=matchMedia('(max-width:768px)');const update=()=>setMobile(mq.matches);update();mq.addEventListener('change',update);return()=>mq.removeEventListener('change',update)},[]);return mobile}
