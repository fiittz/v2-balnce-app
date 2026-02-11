interface SparklineChartProps {
  data: number[];
  color?: string;
  className?: string;
}

const SparklineChart = ({ data, color = "currentColor", className = "" }: SparklineChartProps) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const height = 40;
  const width = 100;
  const padding = 2;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * (width - padding * 2) + padding;
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg 
      viewBox={`0 0 ${width} ${height}`} 
      className={`${className}`}
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default SparklineChart;
