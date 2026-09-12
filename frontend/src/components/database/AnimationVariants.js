// Animation variants for framer-motion
export const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { 
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

export const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 12
    }
  }
};

export const cardVariants = {
  hidden: { scale: 0.9, opacity: 0 },
  visible: { 
    scale: 1, 
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15
    }
  },
  hover: { 
    y: -15,
    scale: 1.03,
    boxShadow: "0px 20px 30px rgba(0, 0, 0, 0.3)",
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 15
    }
  },
  tap: { 
    scale: 0.98,
    boxShadow: "0px 10px 15px rgba(0, 0, 0, 0.2)",
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 10
    }
  }
};
