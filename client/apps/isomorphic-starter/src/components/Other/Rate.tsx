import React from "react";
import * as Icon from "react-icons/pi";

interface RateProps {
  currentRate: number | undefined;
  size: number;
}

const Rate: React.FC<RateProps> = ({ currentRate, size }) => {
  let arrOfStar = [];
  
  for (let i = 0; i < 5; i++) {
    if (currentRate) {
      if (i >= currentRate) {
        arrOfStar.push(<Icon.PiStarFill key={i} size={size} color="#9FA09C" />);
      } else {
        arrOfStar.push(<Icon.PiStarFill key={i} size={size} color="#ECB018" />);
      }
    }
  }
  
  return <div className="rate flex">{arrOfStar}</div>;
};

export default Rate;
