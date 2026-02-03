import React, { useEffect, useRef, useState } from "react";
import Logo from "/src/Assets/Images/datahacks-logo.png";
import { useMediaQuery } from "usehooks-ts";

const Navbar = () => {
  const media = useMediaQuery("(min-width:768px)");
  const [buttonClick, setButtonClick] = useState(false);

  if (!media)
    return (
      <div className="fixed top-2 h-[10vh] flex justify-between items-center z-100 w-full ">
        <button className="ml-5 hover:cursor-pointer w-[8vh] ">
          <img src={Logo} alt="Logo" />
        </button>
        <div
          className={`absolute right-0 m-1 rounded-lg top-0 py-4 flex flex-col items-end text-xl font-bold gap-6 px-6 bg-[#D1F4F9] backdrop-filter overflow-hidden duration-300 `}
          style={{
            width: buttonClick ? "10rem" : "5rem",
            height: buttonClick ? "26rem" : "3.5rem",
          }}
        >
          <button
            className="h-fit w-8 flex flex-col gap-1 cursor-pointer"
            onClick={() => setButtonClick(!buttonClick)}
          >
            <span className="w-full h-1 bg-black"></span>
            <span className="w-full h-1 bg-black"></span>
            <span className="w-full h-1 bg-black"></span>
          </button>
          <Buttons />
        </div>
      </div>
    );
  else {
    return (
      <div className="sticky top-0 h-[10vh] flex items-center z-100 bg-transparent">
        <button className="ml-5 hover:cursor-pointer w-[8vh]">
          <img src={Logo} alt="Logo" />
        </button>
        <div className="flex items-center justify-end w-full text-xl font-bold gap-6 px-6">
          <Buttons />
        </div>
      </div>
    );
  }
};

const Buttons = () => {
  const btnClass =
    "hover:cursor-pointer hover:bg-white/20 transition-all duration-200 px-4 py-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20";

  const prizesRef = useRef<HTMLElement | null>(null);
  const sponsorsRef = useRef<HTMLElement | null>(null);
  const faqRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    prizesRef.current = document.getElementById("prizes");
    sponsorsRef.current = document.getElementById("sponsors");
    faqRef.current = document.getElementById("faq");
  }, []);

  const scroll = (ref: React.RefObject<HTMLElement | null>) => {
    if (ref) {
      const offset = 0.12 * window.innerHeight;
      const top = ref.current?.getBoundingClientRect().top;
      const topPosition = top! + window.scrollY - offset;

      window.scrollTo({
        top: topPosition,
        behavior: "smooth",
      });
    }
  };

  return (
    <>
      <button className={btnClass} onClick={() => scroll(prizesRef)}>
        Prizes
      </button>
      <button className={btnClass} onClick={() => scroll(sponsorsRef)}>
        Sponsors
      </button>
      <button className={btnClass} onClick={() => scroll(faqRef)}>
        FAQ
      </button>

      <a
        href="https://datahacks-2026.devpost.com/"
        target="_blank"
        rel="noopener noreferrer"
        className={btnClass}
      >
        Devpost
      </a>

      <a
        href="https://sites.google.com/u/0/d/1iTwbKviMY4g2dVD3iAQ08iESCG66_u75/p/1GVxha23ZrYK60O4zTKNHnRJrXBMEu_C_/preview"
        target="_blank"
        rel="noopener noreferrer"
        className={btnClass}
      >
        Hacker Guide
      </a>

      <a
        href="https://forms.fillout.com/t/5MJ4HUiZF5us"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:cursor-pointer hover:brightness-110 transition-all duration-200 bg-orange-500 text-white px-5 py-2 rounded-lg font-semibold shadow-lg"
      >
        Sign Up
      </a>
    </>
  );
};

export default Navbar;
