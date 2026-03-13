import { useState, useEffect, useCallback } from 'react';

const useShopDepartmentPopup = () => {
  const [openShopDepartmentPopup, setOpenShopDepartmentPopup] = useState(false);

  const handleShopDepartmentPopup = () => {
    setOpenShopDepartmentPopup((toggleOpen) => !toggleOpen);
  };

  const handleClickOutsideShopDepartmentPopup = useCallback((event: Event) => {
    const targetElement = event.target as Element;
    if (openShopDepartmentPopup && !targetElement.closest('.shop-department-popup')) {
      setOpenShopDepartmentPopup(false);
    }
  }, [openShopDepartmentPopup]);

  useEffect(() => {
    document.addEventListener('click', handleClickOutsideShopDepartmentPopup);
    return () => {
      document.removeEventListener('click', handleClickOutsideShopDepartmentPopup);
    };
  }, [handleClickOutsideShopDepartmentPopup, openShopDepartmentPopup]);

  return { openShopDepartmentPopup, handleShopDepartmentPopup };
};

export default useShopDepartmentPopup;
