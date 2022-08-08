import Text from '@/misc/Text';

const txt = Text.home.projects;

const Projects = () => (
  <div className="flex-col flex bg-slate-700">
    {txt.arr.map((project) => (
      <div className="flex flex-col justify-center align-middle">
        {project.photo && (
        <img src={project.photo} alt={project.title} className="w-64 rounded-full m-auto" />
        )}
        <div className="">
          {project.title}
        </div>
        <div className="bg-white p-[2px] rounded-full mt-1" />
        <div className="">
          {project.text}
        </div>
      </div>
    ))}
  </div>
);

export default Projects;
