"use client";
import React from "react";
import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import reviewData from "@/data/Testimonial.json";
import TestimonialItem from "@/components/Testimonial/TestimonialItem";
const CustomerFeedbacks = () => {
return (
<>
      <div className="relative w-full">
        {" "}
        <Breadcrumb
          heading="Customer Feedbacks"
          subHeading="Customer Feedbacks"
        />{" "}
      </div>{" "}
      <div className="customer-feedbacks md:py-20 py-10">
        {" "}
        <div className="container">
          {" "}
          <div className="list-review grid lg:grid-cols-3 sm:grid-cols-2 grid-cols-1 md:gap-[30px] gap-5">
            {" "}
            {reviewData.map((item) => (
              <TestimonialItem key={item.id} data={item} type="style-one" />
            ))}{" "}
          </div>{" "}
        </div>{" "}
      </div>{" "}
    </>
  );
};
export default CustomerFeedbacks;
