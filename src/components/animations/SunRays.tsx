 const SunRays = () => {
   return (
     <div className="absolute inset-0 animate-sun-rays">
       {[...Array(8)].map((_, i) => (
         <div
           key={i}
           className="absolute top-1/2 left-1/2 w-2 h-32 bg-gradient-to-t from-sun/60 to-transparent origin-bottom"
           style={{
             transform: `translate(-50%, -100%) rotate(${i * 45}deg)`,
           }}
         />
       ))}
     </div>
   );
 };
 
 export default SunRays;