export const Sound = ({file}) => {
  console.log(file)
  return <audio autoPlay>
    <source src={`/sounds/${file}`} type="audio/mpeg" />
  </audio>
}
