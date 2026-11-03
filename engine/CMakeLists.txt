cmake_minimum_required(VERSION 3.14)
project(PathForgeEngine VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(MSVC)
    add_compile_options(/O2 /W4)
else()
    add_compile_options(-O3 -Wall -Wextra -pedantic)
endif()

include_directories(${CMAKE_CURRENT_SOURCE_DIR}/include)

add_executable(pathforge_cli src/pathforge_cli.cpp)
