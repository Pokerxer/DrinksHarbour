export default function ControlledTable({ children, ...props }: any) {
  return <table {...props}>{children}</table>;
}
