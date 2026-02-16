"use client";
import React from "react";
import Image from "next/image";
import Breadcrumb from "@/components/Breadcrumb/Breadcrumb";
import { ProductType } from "@/type/ProductType";
import { useCompare } from "@/context/CompareContext";
import { useCart } from "@/context/CartContext";
import { useModalCartContext } from "@/context/ModalCartContext";
import Rate from "@/components/Other/Rate";
const Compare = () => {
  const { compareState } = useCompare();
  const { cartState, addToCart, updateQuantity, getCartItemId } = useCart();
  const { openModalCart } = useModalCartContext();
  const handleAddToCart = (productItem: ProductType) => {
    const cartItemId = getCartItemId(productItem.id, '', '', '');
    const existingItem = cartState.cartArray.find((item) => item.cartItemId === cartItemId);
    
    if (existingItem) {
      updateQuantity(cartItemId, (existingItem.quantity || 1) + 1);
    } else {
      addToCart(productItem, '', '', '');
    }
    openModalCart();
  };
  return (
    <>
      <div className="relative w-full">
        <Breadcrumb
          heading="Compare Products"
          subHeading="Compare Products"
        />
      </div>
      <div className="compare-block md:py-20 py-10">
        <div className="container">
          <div className="content-main">
            <div>
              <div className="list-product flex">
                <div className="left lg:w-[240px] w-[170px] flex-shrink-0"></div>
                <div className="right flex w-full border border-line rounded-t-2xl border-b-0">
                  {compareState.compareArray.map((item) => (
                    <div
                      className="product-item px-10 pt-6 pb-5 border-r border-line"
                      key={item.id}
                    >
                      <div className="bg-img w-full aspect-[3/4] rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                        {item.images && item.images.length > 0 && typeof item.images[0] === 'string' && item.images[0] ? (
                          <Image
                            src={item.images[0]}
                            width={1000}
                            height={1500}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            No Image
                          </div>
                        )}
                      </div>
                      <div className="text-title text-center mt-4">
                        {item.name}
                      </div>
                      <div className="caption2 font-semibold text-secondary2 uppercase text-center mt-1">
                        {item.brand}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="compare-table flex">
                <div className="left lg:w-[240px] w-[170px] flex-shrink-0 border border-line border-r-0 rounded-l-2xl">
                  <div className="item text-button flex items-center h-[60px] px-8 w-full border-b border-line">
                    Rating
                  </div>
                  <div className="item text-button flex items-center h-[60px] px-8 w-full border-b border-line">
                    Price
                  </div>
                  <div className="item text-button flex items-center h-[60px] px-8 w-full border-b border-line">
                    Type
                  </div>
                  <div className="item text-button flex items-center h-[60px] px-8 w-full border-b border-line">
                    Brand
                  </div>
                  <div className="item text-button flex items-center h-[60px] px-8 w-full border-b border-line">
                    Size
                  </div>
                  <div className="item text-button flex items-center h-[60px] px-8 w-full border-b border-line">
                    Colors
                  </div>
                  <div className="item text-button flex items-center h-[60px] px-8 w-full border-b border-line">
                    Material
                  </div>
                  <div className="item text-button flex items-center h-[60px] px-8 w-full border-b border-line">
                    Add To Cart
                  </div>
                </div>
                <table className="right border-collapse w-full border-t border-r border-line">
                  <tbody>
                    <tr className="flex w-full items-center">
                      {compareState.compareArray.map((item, index) => (
                        <td
                          className="w-full border border-line h-[60px] border-t-0 border-r-0"
                          key={index}
                        >
                          <div className="h-full flex items-center justify-center">
                            <Rate currentRate={item.rate} size={12} />
                            <p className="pl-1">({item.reviewCount || 0})</p>
                          </div>
                        </td>
                      ))}
                    </tr>
                    <tr className="flex w-full items-center">
                      {compareState.compareArray.map((item, index) => (
                        <td
                          className="w-full border border-line h-[60px] border-t-0 border-r-0"
                          key={index}
                        >
                          <div className="h-full flex items-center justify-center">
                            ${item.price.toFixed(2)}
                          </div>
                        </td>
                      ))}
                    </tr>
                    <tr className="flex w-full items-center">
                      {compareState.compareArray.map((item, index) => (
                        <td
                          className="w-full border border-line h-[60px] border-t-0 border-r-0"
                          key={index}
                        >
                          <div className="h-full flex items-center justify-center capitalize">
                            {item.type}
                          </div>
                        </td>
                      ))}
                    </tr>
                    <tr className="flex w-full items-center">
                      {compareState.compareArray.map((item, index) => (
                        <td
                          className="w-full border border-line h-[60px] border-t-0 border-r-0"
                          key={index}
                        >
                          <div className="h-full flex items-center justify-center capitalize">
                            {item.brand}
                          </div>
                        </td>
                      ))}
                    </tr>
                    <tr className="flex w-full items-center">
                      {compareState.compareArray.map((item, index) => (
                        <td
                          className="w-full border border-line h-[60px] border-t-0 border-r-0 size"
                          key={index}
                        >
                          <div className="h-full flex items-center justify-center capitalize gap-1">
                            {item.sizes?.map((size: string, i: number) => (
                              <p key={i}>
                                {size}
                                {i < item.sizes.length - 1 && <span>, </span>}
                              </p>
                            ))}
                          </div>
                        </td>
                      ))}
                    </tr>
                    <tr className="flex w-full items-center">
                      {compareState.compareArray.map((item, index) => (
                        <td
                          className="w-full border border-line h-[60px] border-t-0 border-r-0 size"
                          key={index}
                        >
                          <div className="h-full flex items-center justify-center capitalize gap-2">
                            {item.variation?.map((colorItem: { colorCode?: string; color?: string }, i: number) => (
                              <span
                                key={i}
                                className="w-6 h-6 rounded-full"
                                style={{
                                  backgroundColor: colorItem.colorCode || colorItem.color || '#ccc',
                                }}
                              ></span>
                            ))}
                          </div>
                        </td>
                      ))}
                    </tr>
                    <tr className="flex w-full items-center">
                      {compareState.compareArray.map((item, index) => (
                        <td
                          className="w-full border border-line h-[60px] border-t-0 border-r-0"
                          key={index}
                        >
                          <div className="h-full flex items-center justify-center capitalize">
                            Organic
                          </div>
                        </td>
                      ))}
                    </tr>
                    <tr className="flex w-full items-center">
                      {compareState.compareArray.map((item, index) => (
                        <td
                          className="w-full border border-line h-[60px] border-t-0 border-r-0"
                          key={index}
                        >
                          <div className="h-full flex items-center justify-center">
                            <button
                              className="button-main py-1.5 px-5"
                              onClick={() => handleAddToCart(item)}
                            >
                              Add To Cart
                            </button>
                          </div>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
export default Compare;
