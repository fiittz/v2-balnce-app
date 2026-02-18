import penguinMascot from "@/assets/penguin-mascot.png";

const PenguinIcon = ({ className = "w-8 h-8" }: { className?: string }) => {
  return <img src={penguinMascot} alt="Balnce Penguin" className={`${className} object-contain`} />;
};

export default PenguinIcon;
