import Text from '@/misc/Text';

const txt = Text.home.projects;

const Projects = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {txt.arr.map((project) => (
      <div className="flex flex-col justify-center align-middle bg-zinc-800/75 rounded-2xl">
        {
					project.link && (
	<a
  href={project.link.url}
  target="_blank"
  rel="noopener noreferrer"
  className="text-xl underline hover:text-gray-300 my-2 mx-auto p-2 hover:bg-zinc-700 rounded-2xl"
	>
  <div className="p-2">
    {project.link.text}
  </div>
  {
		project.photo && <img src={project.photo} alt={project.title} className="w-64 cursor-pointer " />
	}
	</a>
					)
				}
        <div className="text-3xl m-2">
          {project.title}
        </div>
        <div className="flex justify-center align-middle">
          <div className="bg-white p-[2px] rounded-full w-9/12 mt-1 m-auto" />
        </div>
        <div className="text-2xl m-3">
          {project.text}
        </div>
      </div>
    ))}
  </div>
);

export default Projects;
