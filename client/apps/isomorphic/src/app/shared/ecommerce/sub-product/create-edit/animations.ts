import { Variants } from 'framer-motion';

export const fieldStaggerVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.04,
      duration: 0.3,
      ease: 'easeOut'
    }
  })
};

export const sectionVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1
    }
  }
};

export const toggleVariants: Variants = {
  hidden: { opacity: 0, height: 0, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 },
  visible: { 
    opacity: 1, 
    height: 'auto',
    transition: {
      duration: 0.3,
      ease: 'easeInOut'
    }
  },
  exit: { 
    opacity: 0, 
    height: 0,
    transition: {
      duration: 0.2,
      ease: 'easeInOut'
    }
  }
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 25
    }
  }
};

export const focusVariants: Variants = {
  focus: {
    scale: 1.01,
    boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.15)'
  },
  blur: {
    scale: 1,
    boxShadow: 'none'
  }
};

export const errorShakeVariants: Variants = {
  shake: {
    x: [0, -5, 5, -5, 5, 0],
    transition: { duration: 0.4 }
  }
};

export const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1
    }
  }
};
