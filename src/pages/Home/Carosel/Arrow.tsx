const Arrow = (props: {
  left?: boolean
  onClick: (e: any) => void
}) => {
  const { left, onClick } = props;

  return (
    <div onClick={onClick} className={`arrowContainer h-full w-10 cursor-pointer ${left ? 'arrow--left' : 'arrow--right'}`}>
      <div className="arrow">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className="flex-1"
        >
          {left ? (
            <path d="M16.67 0l2.83 2.829-9.339 9.175 9.339 9.167-2.83 2.829-12.17-11.996z" />
          ) : (
            <path d="M5 3l3.057-3 11.943 12-11.943 12-3.057-3 9-9z" />
          )}
        </svg>
      </div>
    </div>

  );
};

Arrow.defaultProps = {
  left: false,
};

export default Arrow;
